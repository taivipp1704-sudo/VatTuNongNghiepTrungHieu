import "reflect-metadata";
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Module,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { json, Response } from "express";
import { Database } from "./db";
import { AuthService, SessionGuard } from "./auth";
import { Operations } from "./operations";
import { Loyalty } from "./loyalty";
import { AppController, PublicController } from "./controller";
import { PhotoController, Photos } from "./photos";
import { Reports } from "./reports";

@Catch()
class ApiExceptionFilter implements ExceptionFilter {
  catch(error: any, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      error instanceof HttpException
        ? error.getStatus()
        : error.code === "23505"
          ? 409
          : error.status === 413
            ? 413
            : error.status === 400 ||
                ["23503", "23514", "22P02", "22003", "22007", "22008"].includes(
                  error.code,
                )
              ? 400
              : 500;
    const message =
      error instanceof HttpException
        ? error.message
        : status === 409
          ? "Mã hàng, tài khoản hoặc dữ liệu này đã tồn tại."
          : status === 413
            ? "Ảnh quá lớn. Chọn lại ảnh để nén trước khi gửi."
            : status === 400
              ? "Dữ liệu liên kết, số lượng hoặc giá trị không hợp lệ."
              : "Không thể hoàn tất yêu cầu. Vui lòng thử lại.";
    if (status === 500) console.error({ name: error.name, code: error.code });
    response.status(status).json({ statusCode: status, message });
  }
}

@Module({
  controllers: [PublicController, AppController, PhotoController],
  providers: [
    Database,
    AuthService,
    SessionGuard,
    Loyalty,
    Operations,
    Photos,
    Reports,
  ],
})
export class AppModule {}

export async function createApp() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    logger: process.env.NODE_ENV === "test" ? false : ["error", "warn", "log"],
  });
  if (process.env.TRUST_PROXY_HOPS === "1") {
    app.getHttpAdapter().getInstance().set("trust proxy", 1);
  }
  app.use(helmet());
  app.use(json({ limit: "512kb" }));
  app.use(
    "/api/auth/login",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: process.env.NODE_ENV === "test" ? 1000 : 20,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        message: "Đã thử đăng nhập nhiều lần. Chờ 15 phút rồi thử lại.",
      },
    }),
  );
  const origins = process.env.CORS_ORIGINS?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  app.enableCors({
    origin:
      origins ??
      (process.env.NODE_ENV === "production"
        ? false
        : [/^https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?$/]),
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
  });
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();
  return app;
}

if (require.main === module)
  createApp()
    .then((app) => app.listen(Number(process.env.PORT ?? 3001), "0.0.0.0"))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
