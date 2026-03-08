from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "terrainposter"
    postgres_user: str = "postgres"
    postgres_password: str = "terrain"

    redis_url: str = "redis://localhost:6379"

    rayshader_url: str = "http://localhost:8787"

    data_dir: str = "/data/processed"

    nominatim_url: str = "https://nominatim.openstreetmap.org"
    nominatim_user_agent: str = "terrainposter/1.0"

    cors_origins: str = "http://localhost:3000"

    render_timeout_seconds: int = 300
    cache_ttl_heightmap: int = 86400
    cache_ttl_render: int = 604800

    @property
    def database_url(self) -> str:
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    model_config = {"env_file": ".env"}


settings = Settings()
