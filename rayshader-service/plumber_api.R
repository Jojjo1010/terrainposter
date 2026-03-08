library(plumber)
library(jsonlite)

source("/app/render.R")

#* @apiTitle Rayshader Terrain Renderer
#* @apiDescription Renders 3D terrain from heightmap data using rayshader

#* Health check
#* @get /health
#* @serializer json
function() {
  list(status = "ok")
}

#* Render a 3D terrain image from heightmap data
#* @post /render
#* @parser multi
#* @parser octet
#* @serializer png
function(req, res) {
  tryCatch({
    # Extract multipart form fields
    body <- req$body

    if (is.null(body$matrix_data) || is.null(body$rows) ||
        is.null(body$cols) || is.null(body$config)) {
      res$status <- 400L
      return(list(error = "Missing required fields: matrix_data, rows, cols, config"))
    }

    rows <- as.integer(body$rows)
    cols <- as.integer(body$cols)

    # Parse config JSON
    config <- fromJSON(body$config)

    # Reconstruct matrix from raw binary (float64, row-major)
    raw_bytes <- if (is.raw(body$matrix_data)) {
      body$matrix_data
    } else if (!is.null(body$matrix_data$value)) {
      body$matrix_data$value
    } else {
      body$matrix_data
    }

    values <- readBin(raw_bytes, what = numeric(), n = rows * cols, size = 8L)

    if (length(values) != rows * cols) {
      res$status <- 400L
      return(list(
        error = paste0(
          "Matrix size mismatch: expected ", rows * cols,
          " values, got ", length(values)
        )
      ))
    }

    heightmap_matrix <- matrix(values, nrow = rows, ncol = cols, byrow = TRUE)

    # Render terrain
    output_path <- render_terrain(heightmap_matrix, config)

    # Read and return the PNG file
    img_data <- readBin(output_path, what = "raw", n = file.info(output_path)$size)

    # Clean up rendered file
    unlink(output_path)

    res$setHeader("Content-Type", "image/png")
    res$body <- img_data
    return(res)

  }, error = function(e) {
    res$status <- 500L
    res$setHeader("Content-Type", "application/json")
    res$body <- toJSON(list(error = e$message), auto_unbox = TRUE)
    return(res)
  })
}
