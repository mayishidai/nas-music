# ---------------------- 第一阶段：构建阶段（含编译工具） ----------------------
FROM node:22.11-alpine AS builder

# 安装编译依赖（Alpine 需手动安装工具链）
RUN apk add --no-cache \
    gcc \
    g++ \
    make \
    python3 \
    git \
    && rm -rf /var/cache/apk/*

# 设置工作目录
WORKDIR /app

# 复制依赖文件（利用 Docker 缓存加速）
COPY package*.json ./

# 安装生产依赖
RUN npm install --registry=https://registry.npmmirror.com

# 复制项目代码（最后复制以最大化利用缓存）
COPY . .


# ---------------------- 第二阶段：运行阶段（仅保留运行时必要文件） ----------------------
FROM node:22.11-alpine
ENV PROJECT_BASE_DIR /opt/app
ENV NODE_OPTIONS --openssl-legacy-provider
WORKDIR ${PROJECT_BASE_DIR}
VOLUME ["/opt/app/music", "/opt/app/db"]
COPY --from=builder /app ./
EXPOSE 3000
ENTRYPOINT ["npm", "start"]