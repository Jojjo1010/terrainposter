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
  && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /app/output

COPY install_packages.R /app/install_packages.R
RUN Rscript /app/install_packages.R

COPY plumber_api.R /app/plumber_api.R
COPY render.R /app/render.R

EXPOSE 8787

CMD ["xvfb-run", "R", "-e", "pr <- plumber::plumb('/app/plumber_api.R'); pr$run(host='0.0.0.0', port=8787)"]
