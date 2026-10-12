FROM node:22-alpine

LABEL org.opencontainers.image.title="Employee Recognition MVP"
LABEL org.opencontainers.image.description="零第三方依赖的员工认可激励平台最小可部署版本"

WORKDIR /app

# 仅拷贝运行所需文件（不含 data，便于挂载卷持久化）
COPY package.json ./
COPY server.js ./
COPY smoke-test.js ./
COPY lib/ ./lib/
COPY public/ ./public/

# 数据目录：可被宿主机卷挂载覆盖
RUN mkdir -p /app/data

ENV PORT=3010
ENV HOST=0.0.0.0
ENV NODE_ENV=production

EXPOSE 3010

# 使用非 root 用户运行
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3010)+'/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
