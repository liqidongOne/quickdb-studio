FROM node:20-alpine AS webui
WORKDIR /src/webui
COPY webui/package*.json ./
RUN npm ci
COPY webui/ ./
RUN npm run build

FROM golang:1.22-alpine AS backend
WORKDIR /src
RUN apk add --no-cache git
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# embed webui dist output
RUN rm -rf internal/webassets/webui_dist && mkdir -p internal/webassets/webui_dist && cp -R /src/webui/dist/* internal/webassets/webui_dist/
RUN CGO_ENABLED=0 go build -o /out/quickdb-studio ./cmd/quickdb-studio

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /
COPY --from=backend /out/quickdb-studio /quickdb-studio
ENV QUICKDB_STUDIO_TOKEN=""
EXPOSE 17890
ENTRYPOINT ["/quickdb-studio"]

