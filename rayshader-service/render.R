library(rayshader)
library(magick)

render_terrain <- function(heightmap_matrix, config) {
  tryCatch({
    # 1. Create color texture from palette
    palette <- unlist(config$palette)
    texture_colors <- grDevices::colorRampPalette(palette)(256)

    # 2. Apply height shading
    shaded <- height_shade(heightmap_matrix, texture = texture_colors)

    # 3. Add ray shadow
    shaded <- add_shadow(
      shaded,
      ray_shade(
        heightmap_matrix,
        sunaltitude = config$sun_angle,
        zscale = config$exaggeration
      )
    )

    # 4. Add ambient shadow
    shaded <- add_shadow(
      shaded,
      ambient_shade(heightmap_matrix, zscale = config$exaggeration)
    )

    # 5. Plot 3D scene
    plot_3d(
      shaded,
      heightmap_matrix,
      zscale = config$exaggeration,
      theta = config$theta,
      phi = config$phi,
      zoom = config$zoom,
      background = config$background_color,
      windowsize = c(config$width, config$height)
    )

    # 6. Generate output filename
    output_file <- tempfile(
      pattern = "terrain_",
      tmpdir = "/app/output",
      fileext = ".png"
    )

    # 7. Render high quality image
    render_highquality(
      output_file,
      width = config$width,
      height = config$height,
      parallel = TRUE
    )

    # 8. Close rgl device
    rgl::rgl.close()

    # 9. Overlay title if provided
    if (!is.null(config$title) && nchar(trimws(config$title)) > 0) {
      img <- image_read(output_file)

      font_family <- if (!is.null(config$font) && nchar(config$font) > 0) {
        config$font
      } else {
        "sans"
      }

      # Calculate font size relative to image width
      font_size <- round(config$width / 20)

      img <- image_annotate(
        img,
        text = config$title,
        gravity = "south",
        size = font_size,
        font = font_family,
        color = "white",
        strokecolor = "black",
        strokewidth = 1,
        location = "+0+40"
      )

      image_write(img, path = output_file, format = "png")
    }

    # 10. Return output file path
    return(output_file)

  }, error = function(e) {
    # Make sure rgl is closed on error
    tryCatch(rgl::rgl.close(), error = function(ignored) NULL)
    stop(paste("Render failed:", e$message))
  })
}
