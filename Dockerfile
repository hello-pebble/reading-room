# 서버 하나로 화면과 API를 함께 낸다. 빌드: docker build -t reading-room .
FROM eclipse-temurin:21-jdk AS build
WORKDIR /src
COPY backend backend
COPY frontend frontend
RUN cd backend && chmod +x gradlew && ./gradlew bootJar -x test --no-daemon

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /src/backend/build/libs/*.jar app.jar
ENV TZ=Asia/Seoul
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s CMD ["bash","-c","exec 3<>/dev/tcp/127.0.0.1/8080 && printf 'GET /health HTTP/1.0\r\n\r\n' >&3 && grep -q 200 <&3"]
ENTRYPOINT ["java","-jar","/app/app.jar"]
