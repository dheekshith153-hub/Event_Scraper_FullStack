# Build stage
FROM golang:1.21-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git make

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o event-scraper cmd/scraper/main.go

# Runtime stage
FROM alpine:latest

# Install ca-certificates and chromium for web scraping
RUN apk --no-cache add ca-certificates chromium

WORKDIR /root/

# Copy the binary from builder
COPY --from=builder /app/event-scraper .

# Create logs directory
RUN mkdir -p logs

# Expose any necessary ports (if you add an API later)
# EXPOSE 8080

# Run the application
CMD ["./event-scraper"]
