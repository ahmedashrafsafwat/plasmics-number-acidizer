FROM public.ecr.aws/lambda/nodejs:18 as builder

WORKDIR /usr/app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production


# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Install build dependencies
RUN npm install -g typescript
RUN npm install --save-dev @types/node @types/aws-lambda

# Build TypeScript
RUN tsc

# Production image
FROM public.ecr.aws/lambda/nodejs:18

WORKDIR ${LAMBDA_TASK_ROOT}

# Copy built application
COPY --from=builder /usr/app/dist ./
COPY --from=builder /usr/app/node_modules ./node_modules

# Set the CMD to your handler
CMD ["index.handler"]
