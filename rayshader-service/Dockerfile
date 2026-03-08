FROM rocker/r-ver:4.3

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-dev \
    libglu1-mesa-dev \
    xvfb \
    libpng-dev \
    libjpeg-dev \
    libfreetype6-dev \
    pandoc \
    libcurl4-openssl-dev \
    libxml2-dev \
    libtiff-dev \
    libsodium-dev \
    gdal-bin \
    libgdal-dev \
    libproj-dev \
    libgeos-dev \
    libmagick++-dev \
    libfontconfig1-dev \
    pkg-config \
  && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /app/output

COPY install_packages.R /app/install_packages.R
RUN Rscript /app/install_packages.R

COPY plumber_api.R /app/plumber_api.R
COPY render.R /app/render.R
COPY start.R /app/start.R
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 8787

CMD ["/app/entrypoint.sh"]
