use std::{
    sync::Arc,
    task::{Context, Poll},
    time,
};

use async_trait::async_trait;
use futures::future::BoxFuture;
use tabby_inference::Embedding;
use tokio::sync::Mutex;
use tower::{Service, ServiceBuilder, ServiceExt};

#[async_trait]
pub trait RateLimiter<I> {
    type Response: Send;
    async fn call(&self, request: I) -> anyhow::Result<Self::Response>;
}

struct RateLimited<T, I> {
    service: Arc<T>,
    _marker: std::marker::PhantomData<I>,
}

impl<T, I> Service<I> for RateLimited<T, I>
where
    T: RateLimiter<I> + 'static + Sync + Send,
    I: Send + 'static,
{
    type Response = T::Response;
    type Error = anyhow::Error;
    type Future = BoxFuture<'static, Result<Self::Response, Self::Error>>;

    fn poll_ready(&mut self, _cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        Poll::Ready(Ok(()))
    }

    fn call(&mut self, input: I) -> Self::Future {
        let service = self.service.clone();
        Box::pin(async move { service.call(input).await })
    }
}

pub struct RateLimitedService<T, I>
where
    T: RateLimiter<I> + 'static,
    I: Send + 'static,
{
    service: Arc<Mutex<tower::util::BoxService<I, T::Response, anyhow::Error>>>,
}

impl<T, I> RateLimitedService<T, I>
where
    T: RateLimiter<I> + 'static,
    I: Send + 'static,
{
    pub fn new(service: Arc<T>, rpm: u64) -> anyhow::Result<Self> {
        if rpm == 0 {
            anyhow::bail!(
                "Can not create rate limited embedding client with 0 requests per minute"
            );
        }

        let service = ServiceBuilder::new()
            .rate_limit(rpm, time::Duration::from_secs(60))
            .service(RateLimited {
                service,
                _marker: std::marker::PhantomData,
            })
            .boxed();

        Ok(Self {
            service: Arc::new(Mutex::new(service)),
        })
    }
}

#[async_trait]
impl Embedding for RateLimitedEmbedding {
    async fn embed(&self, prompt: &str) -> anyhow::Result<Vec<f32>> {
        let mut service = self.embedding.lock().await;
        let prompt_owned = prompt.to_string();
        let response = service.ready().await?.call(prompt_owned).await?;
        Ok(response)
    }
}
