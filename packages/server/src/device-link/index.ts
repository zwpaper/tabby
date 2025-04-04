import { getSessionFromCtx } from "better-auth/api";
import { generateRandomString } from "better-auth/crypto";
import { type BetterAuthPlugin, createAuthEndpoint } from "better-auth/plugins";
import { z } from "zod";

type TokenValue = {
  deviceName: string;
  userId?: string;
};

export const deviceLink = () => {
  return {
    id: "device-link",
    endpoints: {
      signInDeviceLink: createAuthEndpoint(
        "/sign-in/device-link",
        {
          method: "POST",
          body: z.object({
            deviceName: z.string({
              description: "Name of the device",
            }),
          }),
          requireHeaders: true,
          metadata: {
            openapi: {
              description: "Sign in with device link",
              responses: {
                200: {
                  description: "Success",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          token: {
                            type: "string",
                          },
                          approveLink: {
                            type: "string",
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        async (ctx) => {
          const { deviceName } = ctx.body;
          const token = generateRandomString(32, "a-z", "A-Z");
          await ctx.context.internalAdapter.createVerificationValue({
            identifier: token,
            value: JSON.stringify({ deviceName }),
            expiresAt: new Date(Date.now() + 60 * 5 * 1000),
          });
          const approveLink = `${ctx.context.baseURL}/device-link/approve?token=${token}`;
          return ctx.json({ token, approveLink });
        },
      ),
      verifyDeviceLink: createAuthEndpoint(
        "/device-link/verify",
        {
          method: "GET",
          query: z.object({
            token: z.string({
              description: "Device link token",
            }),
          }),
          requireHeaders: true,
          metadata: {
            openapi: {
              description: "Load session information from a device link token",
              responses: {
                200: {
                  description: "Success",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          session: {
                            $ref: "#/components/schemas/Session",
                          },
                          user: {
                            $ref: "#/components/schemas/User",
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        async (ctx) => {
          const { token } = ctx.query;
          let tokenValue: Awaited<
            ReturnType<typeof ctx.context.internalAdapter.findVerificationValue>
          >;
          let parsedTokenValue: TokenValue;
          do {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            tokenValue =
              await ctx.context.internalAdapter.findVerificationValue(token);
            if (!tokenValue) {
              return ctx.json({ error: "INVALID_TOKEN" }, { status: 400 });
            }
            if (tokenValue.expiresAt < new Date()) {
              await ctx.context.internalAdapter.deleteVerificationValue(
                tokenValue.id,
              );
              return ctx.json({ error: "EXPIRED_TOKEN" }, { status: 400 });
            }
            parsedTokenValue = JSON.parse(tokenValue.value);
          } while (!parsedTokenValue.userId);

          // tokenValue is set, so we can safely delete it
          await ctx.context.internalAdapter.deleteVerificationValue(
            tokenValue.id,
          );
          const user = await ctx.context.internalAdapter.findUserById(
            parsedTokenValue.userId,
          );

          if (!user) {
            return ctx.json({ error: "USER_NOT_FOUND" }, { status: 400 });
          }

          const session = await ctx.context.internalAdapter.createSession(
            user.id,
            ctx.headers,
          );

          if (!session) {
            return ctx.json(
              { error: "FAILED_TO_CREATE_SESSION" },
              { status: 400 },
            );
          }

          return ctx.json({
            token: session.token,
            user: {
              id: user.id,
              email: user.email,
              emailVerified: user.emailVerified,
              name: user.name,
              image: user.image,
              createdAt: user.createdAt,
              updatedAt: user.updatedAt,
            },
          });
        },
      ),
      approveDeviceLink: createAuthEndpoint(
        "/device-link/approve",
        {
          method: "GET",
          query: z.object({
            token: z.string({
              description: "Device link token",
            }),
          }),
          requireHeaders: true,
          metadata: {
            openapi: {
              description: "Load session information from a device link token",
              responses: {
                200: {
                  description: "Success",
                },
              },
            },
          },
        },
        async (ctx) => {
          const { token } = ctx.query;
          const tokenValue =
            await ctx.context.internalAdapter.findVerificationValue(token);
          if (!tokenValue) {
            return ctx.json({ error: "INVALID_TOKEN" }, { status: 400 });
          }
          if (tokenValue.expiresAt < new Date()) {
            await ctx.context.internalAdapter.deleteVerificationValue(
              tokenValue.id,
            );
            return ctx.json({ error: "EXPIRED_TOKEN" }, { status: 400 });
          }
          const parsedTokenValue: TokenValue = JSON.parse(tokenValue.value);
          // value is already set by another approval.
          if (parsedTokenValue.userId) {
            return ctx.json({ error: "INVALID_TOKEN" }, { status: 400 });
          }

          const session = await getSessionFromCtx(ctx);
          if (!session) {
            return ctx.redirect(
              `/login?callbackURL=${encodeURIComponent(ctx.request?.url || "")}&deviceName=${encodeURIComponent(parsedTokenValue.deviceName)}`,
            );
          }
          // approve verification token to be logined as the current user.
          await ctx.context.internalAdapter.updateVerificationValue(
            tokenValue.id,
            {
              value: JSON.stringify({
                ...parsedTokenValue,
                userId: session.user.id,
              }),
            },
          );

          throw ctx.redirect("/");
        },
      ),
    },
    rateLimit: [
      {
        pathMatcher(path) {
          return (
            path.startsWith("/sign-in/device-link") ||
            path.startsWith("/device-link")
          );
        },
        window: 60,
        max: 5,
      },
    ],
  } satisfies BetterAuthPlugin;
};
