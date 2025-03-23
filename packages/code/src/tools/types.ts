export function safeCall<T>(x: Promise<T>) {
    return x.catch((e) => {
        return {
            error: e.message
        }
    });
}