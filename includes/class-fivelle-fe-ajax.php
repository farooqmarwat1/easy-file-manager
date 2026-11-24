<?php
/**
 * AJAX endpoints. Every request needs a valid nonce + explorer permission,
 * and every write needs read-only mode to be off.
 *
 * @package EasyFileManager
 */

defined( 'ABSPATH' ) || exit;

/**
 * AJAX controller.
 */
class Fivelle_FE_Ajax {

	const READ_OPS  = array( 'list', 'tree', 'info', 'dirsize', 'read', 'search', 'stats' );
	const WRITE_OPS = array( 'mkdir', 'mkfile', 'rename', 'delete', 'paste', 'duplicate', 'save', 'chmod', 'compress', 'extract' );

	/**
	 * Register hooks.
	 */
	public static function init() {
		add_action( 'wp_ajax_fivelle_fe', array( __CLASS__, 'dispatch' ) );
		add_action( 'wp_ajax_fivelle_fe_upload', array( __CLASS__, 'upload' ) );
		add_action( 'wp_ajax_fivelle_fe_raw', array( __CLASS__, 'raw' ) );
		add_action( 'wp_ajax_fivelle_fe_zip', array( __CLASS__, 'zip_download' ) );
	}

	/* --------------------------------------------------------------------- */
	/* Helpers                                                                */
	/* --------------------------------------------------------------------- */

	/**
	 * Verify nonce, permission and (for writes) read-only mode.
	 *
	 * @param bool $write Whether the request modifies files.
	 */
	private static function guard( $write ) {
		if ( ! check_ajax_referer( 'fivelle_fe', 'nonce', false ) ) {
			self::fail( __( 'Your session has expired. Please reload the page.', 'easy-file-manager' ), 403 );
		}
		if ( ! Fivelle_FE_Plugin::user_can() ) {
			self::fail( __( 'You do not have permission to use the file explorer.', 'easy-file-manager' ), 403 );
		}
		if ( $write && Fivelle_FE_Plugin::read_only() ) {
			self::fail( __( 'The file explorer is in read-only mode.', 'easy-file-manager' ), 403 );
		}
	}

	/**
	 * Send an error and stop.
	 *
	 * @param string $message Message.
	 * @param int    $status  HTTP status.
	 * @param array  $extra   Extra data.
	 */
	private static function fail( $message, $status = 400, $extra = array() ) {
		wp_send_json_error( array_merge( array( 'message' => $message ), $extra ), $status );
	}

	/**
	 * Raw request value (unslashed). Paths are validated by the filesystem layer.
	 *
	 * @param string $key     Key.
	 * @param mixed  $default Default.
	 * @return mixed
	 */
	private static function arg( $key, $default = '' ) {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.ValidatedSanitizedInput
		return isset( $_REQUEST[ $key ] ) ? wp_unslash( $_REQUEST[ $key ] ) : $default;
	}

	/**
	 * JSON-encoded list of relative paths.
	 *
	 * @return string[]
	 */
	private static function arg_paths() {
		$raw  = self::arg( 'paths', '[]' );
		$list = is_array( $raw ) ? $raw : json_decode( (string) $raw, true );
		if ( ! is_array( $list ) || empty( $list ) ) {
			self::fail( __( 'Nothing selected.', 'easy-file-manager' ) );
		}
		return array_values( array_map( 'strval', array_slice( $list, 0, 2000 ) ) );
	}

	/**
	 * Boolean argument.
	 *
	 * @param string $key Key.
	 * @return bool
	 */
	private static function arg_bool( $key ) {
		return in_array( (string) self::arg( $key, '0' ), array( '1', 'true', 'yes' ), true );
	}

	/* --------------------------------------------------------------------- */
	/* Router                                                                 */
	/* --------------------------------------------------------------------- */

	/**
	 * Route `op` to an op_* method.
	 */
	public static function dispatch() {
		$op    = sanitize_key( (string) self::arg( 'op' ) );
		$write = in_array( $op, self::WRITE_OPS, true );
		if ( ! $write && ! in_array( $op, self::READ_OPS, true ) ) {
			self::fail( __( 'Unknown action.', 'easy-file-manager' ) );
		}
		self::guard( $write );

		try {
			$fs     = Fivelle_FE_Plugin::fs();
			$method = 'op_' . $op;
			wp_send_json_success( self::$method( $fs ) );
		} catch ( Fivelle_FE_Exception $e ) {
			self::fail( $e->getMessage() );
		} catch ( Throwable $e ) {
			/* translators: %s: error */
			self::fail( sprintf( __( 'Unexpected error: %s', 'easy-file-manager' ), $e->getMessage() ), 500 );
		}
	}

	/* --------------------------------------------------------------------- */
	/* Read operations                                                        */
	/* --------------------------------------------------------------------- */

	/**
	 * List folder contents.
	 *
	 * @param Fivelle_FE_Filesystem $fs FS.
	 * @return array
	 */
	private static function op_list( $fs ) {
		$abs  = $fs->resolve_dir( self::arg( 'path' ) );
		$data = $fs->list_dir( $abs, self::arg_bool( 'hidden' ) );
		return array_merge(
			$data,
			array(
				'path' => $fs->rel( $abs ),
				'w'    => is_writable( $abs ),
			)
		);
	}

	/**
	 * Sub-folders for the sidebar tree.
	 *
	 * @param Fivelle_FE_Filesystem $fs FS.
	 * @return array
	 */
	private static function op_tree( $fs ) {
		$abs  = $fs->resolve_dir( self::arg( 'path' ) );
		$data = $fs->list_dir( $abs, self::arg_bool( 'hidden' ), true, 2000 );
		$out  = array();
		foreach ( $data['items'] as $item ) {
			$out[] = array(
				'name'   => $item['name'],
				'path'   => $item['path'],
				'hidden' => $item['hidden'],
			);
		}
		return array( 'items' => $out );
	}

	/**
	 * Item details.
	 *
	 * @param Fivelle_FE_Filesystem $fs FS.
	 * @return array
	 */
	private static function op_info( $fs ) {
		return $fs->info( $fs->resolve( self::arg( 'path' ) ) );
	}

	/**
	 * Folder size.
	 *
	 * @param Fivelle_FE_Filesystem $fs FS.
	 * @return array
	 */
	private static function op_dirsize( $fs ) {
		return $fs->dir_size( $fs->resolve_dir( self::arg( 'path' ) ) );
	}

	/**
	 * Read a text file.
	 *
	 * @param Fivelle_FE_Filesystem $fs FS.
	 * @return array
	 */
	private static function op_read( $fs ) {
		$abs = $fs->resolve( self::arg( 'path' ) );
		return $fs->read_text( $abs, max( 64, (int) Fivelle_FE_Plugin::setting( 'editor_max_kb' ) ) );
	}

	/**
	 * Recursive search.
	 *
	 * @param Fivelle_FE_Filesystem $fs FS.
	 * @return array
	 */
	private static function op_search( $fs ) {
		$q = trim( (string) self::arg( 'q' ) );
		if ( strlen( $q ) < 2 ) {
			throw new Fivelle_FE_Exception( __( 'Type at least 2 characters to search.', 'easy-file-manager' ) );
		}
		return $fs->search( $fs->resolve_dir( self::arg( 'path' ) ), $q, self::arg_bool( 'hidden' ) );
	}

	/**
	 * Server / disk stats.
	 *
	 * @param Fivelle_FE_Filesystem $fs FS.
	 * @return array
	 */
	private static function op_stats( $fs ) {
		return array(
			'disk'       => $fs->disk(),
			'php'        => PHP_VERSION,
			'wp'         => get_bloginfo( 'version' ),
			'server'     => isset( $_SERVER['SERVER_SOFTWARE'] ) ? sanitize_text_field( wp_unslash( $_SERVER['SERVER_SOFTWARE'] ) ) : '',
			'zip'        => class_exists( 'ZipArchive' ),
			'max_upload' => (int) wp_max_upload_size(),
		);
	}

	/* --------------------------------------------------------------------- */
	/* Write operations                                                       */
	/* --------------------------------------------------------------------- */

	/**
	 * New folder.
	 *
	 * @param Fivelle_FE_Filesystem $fs FS.
	 * @return array
	 */
	private static function op_mkdir( $fs ) {
		$dir  = $fs->resolve_dir( self::arg( 'path' ) );
		$path = $fs->mkdir( $dir, self::arg( 'name' ) );
		$rel  = $fs->rel( $path );
		Fivelle_FE_Logger::add( 'mkdir', $rel );
		return array( 'path' => $rel );
	}

	/**
	 * New file.
	 *
	 * @param Fivelle_FE_Filesystem $fs FS.
	 * @return array
	 */
	private static function op_mkfile( $fs ) {
		$dir  = $fs->resolve_dir( self::arg( 'path' ) );
		$path = $fs->mkfile( $dir, self::arg( 'name' ) );
		$rel  = $fs->rel( $path );
		Fivelle_FE_Logger::add( 'mkfile', $rel );
		return array( 'path' => $rel );
	}

	/**
	 * Rename.
	 *
	 * @param Fivelle_FE_Filesystem $fs FS.
	 * @return array
	 */
	private static function op_rename( $fs ) {
		$abs  = $fs->resolve( self::arg( 'path' ) );
		$old  = $fs->rel( $abs );
		$dest = $fs->rename( $abs, self::arg( 'name' ) );
		$rel  = $fs->rel( $dest );
		Fivelle_FE_Logger::add( 'rename', $old, '→ ' . basename( $dest ) );
		return array( 'path' => $rel );
	}

	/**
	 * Delete items.
	 *
	 * @param Fivelle_FE_Filesystem $fs FS.
	 * @return array
	 */
	private static function op_delete( $fs ) {
		$done = 0;
		foreach ( self::arg_paths() as $rel ) {
			$abs = $fs->resolve( $rel );
			$fs->delete( $abs );
			Fivelle_FE_Logger::add( 'delete', $fs->rel( $abs ) );
			++$done;
		}
		return array( 'count' => $done );
	}

	/**
	 * Copy or move items into a folder.
	 *
	 * @param Fivelle_FE_Filesystem $fs FS.
	 * @return array
	 */
	private static function op_paste( $fs ) {
		$dest = $fs->resolve_dir( self::arg( 'dest' ) );
		$mode = 'move' === self::arg( 'mode' ) ? 'move' : 'copy';
		if ( ! is_writable( $dest ) ) {
			throw new Fivelle_FE_Exception( __( 'The destination folder is not writable.', 'easy-file-manager' ) );
		}
		$out = array();
		foreach ( self::arg_paths() as $rel ) {
			$src = $fs->resolve( $rel );
			if ( 'move' === $mode && dirname( $src ) === $dest ) {
				continue; // Already there.
			}
			$name   = $fs->unique_name( $dest, basename( $src ) );
			$target = $dest . DIRECTORY_SEPARATOR . $name;
			if ( 'move' === $mode ) {
				$fs->move_item( $src, $target );
			} else {
				$fs->copy_item( $src, $target );
			}
			$out[] = $fs->rel( $target );
			Fivelle_FE_Logger::add( $mode, $fs->rel( $src ), '→ ' . $fs->rel( $target ) );
		}
		return array( 'paths' => $out );
	}

	/**
	 * Duplicate items next to themselves.
	 *
	 * @param Fivelle_FE_Filesystem $fs FS.
	 * @return array
	 */
	private static function op_duplicate( $fs ) {
		$out = array();
		foreach ( self::arg_paths() as $rel ) {
			$src    = $fs->resolve( $rel );
			$dir    = dirname( $src );
			$target = $dir . DIRECTORY_SEPARATOR . $fs->unique_name( $dir, basename( $src ) );
			$fs->copy_item( $src, $target );
			$out[] = $fs->rel( $target );
			Fivelle_FE_Logger::add( 'duplicate', $fs->rel( $src ), '→ ' . basename( $target ) );
		}
		return array( 'paths' => $out );
	}

	/**
	 * Save a file from the editor. Detects changes made by someone else since opening.
	 *
	 * @param Fivelle_FE_Filesystem $fs FS.
	 * @return array
	 */
	private static function op_save( $fs ) {
		$abs   = $fs->resolve( self::arg( 'path' ) );
		$mtime = (int) self::arg( 'mtime', 0 );
		clearstatcache( true, $abs );
		if ( $mtime && ! self::arg_bool( 'force' ) && (int) filemtime( $abs ) > $mtime ) {
			self::fail( __( 'This file was changed on the server after you opened it.', 'easy-file-manager' ), 409, array( 'code' => 'conflict' ) );
		}
		$fs->write_text( $abs, (string) self::arg( 'content' ) );
		Fivelle_FE_Logger::add( 'edit', $fs->rel( $abs ) );
		return array(
			'mtime' => (int) filemtime( $abs ),
			'size'  => (int) filesize( $abs ),
		);
	}

	/**
	 * Change permissions.
	 *
	 * @param Fivelle_FE_Filesystem $fs FS.
	 * @return array
	 */
	private static function op_chmod( $fs ) {
		$abs  = $fs->resolve( self::arg( 'path' ) );
		$mode = (string) self::arg( 'mode' );
		$fs->chmod( $abs, $mode );
		Fivelle_FE_Logger::add( 'chmod', $fs->rel( $abs ), $mode );
		return array( 'perms' => substr( sprintf( '%o', fileperms( $abs ) ), -4 ) );
	}

	/**
	 * Create a zip archive from items.
	 *
	 * @param Fivelle_FE_Filesystem $fs FS.
	 * @return array
	 */
	private static function op_compress( $fs ) {
		$dir   = $fs->resolve_dir( self::arg( 'path' ) );
		$items = array();
		foreach ( self::arg_paths() as $rel ) {
			$items[] = $fs->resolve( $rel );
		}
		$name = trim( (string) self::arg( 'name' ) );
		if ( '' === $name ) {
			$name = 1 === count( $items ) ? basename( $items[0] ) : 'archive';
		}
		if ( '.zip' !== strtolower( substr( $name, -4 ) ) ) {
			$name .= '.zip';
		}
		$fs->child( $dir, $name ); // Validates the name.
		$zip = $dir . DIRECTORY_SEPARATOR . $fs->unique_name( $dir, $name );
		$fs->compress( $items, $zip );
		$rel = $fs->rel( $zip );
		Fivelle_FE_Logger::add( 'compress', $rel, count( $items ) . ' item(s)' );
		return array( 'path' => $rel );
	}

	/**
	 * Extract a zip archive into a sibling folder.
	 *
	 * @param Fivelle_FE_Filesystem $fs FS.
	 * @return array
	 */
	private static function op_extract( $fs ) {
		$zip  = $fs->resolve( self::arg( 'path' ) );
		$dir  = dirname( $zip );
		$here = self::arg_bool( 'here' );
		if ( $here ) {
			$dest = $dir;
		} else {
			$base = preg_replace( '/\.zip$/i', '', basename( $zip ) );
			$dest = $dir . DIRECTORY_SEPARATOR . $fs->unique_name( $dir, '' === $base ? 'extracted' : $base );
		}
		$count = $fs->extract( $zip, $dest );
		$rel   = $fs->rel( $dest );
		Fivelle_FE_Logger::add( 'extract', $fs->rel( $zip ), '→ ' . ( '' === $rel ? '/' : $rel ) );
		return array(
			'path'  => $rel,
			'count' => $count,
		);
	}

	/* --------------------------------------------------------------------- */
	/* Upload & download                                                      */
	/* --------------------------------------------------------------------- */

	/**
	 * Upload one file (the browser sends files one by one for progress bars).
	 * `relpath` keeps folder structure when whole folders are dropped.
	 */
	public static function upload() {
		self::guard( true );
		try {
			$fs  = Fivelle_FE_Plugin::fs();
			$dir = $fs->resolve_dir( self::arg( 'path' ) );

			// phpcs:ignore WordPress.Security.NonceVerification.Missing -- verified in guard().
			if ( empty( $_FILES['file'] ) || ! is_array( $_FILES['file'] ) ) {
				throw new Fivelle_FE_Exception( __( 'No file received.', 'easy-file-manager' ) );
			}
			$file = $_FILES['file']; // phpcs:ignore WordPress.Security.NonceVerification.Missing, WordPress.Security.ValidatedSanitizedInput

			if ( ! empty( $file['error'] ) ) {
				$limit = size_format( wp_max_upload_size() );
				$codes = array(
					UPLOAD_ERR_INI_SIZE   => sprintf( /* translators: %s: size */ __( 'The file exceeds the server upload limit (%s).', 'easy-file-manager' ), $limit ),
					UPLOAD_ERR_FORM_SIZE  => sprintf( /* translators: %s: size */ __( 'The file exceeds the server upload limit (%s).', 'easy-file-manager' ), $limit ),
					UPLOAD_ERR_PARTIAL    => __( 'The file was only partially uploaded.', 'easy-file-manager' ),
					UPLOAD_ERR_NO_TMP_DIR => __( 'The server has no temporary folder.', 'easy-file-manager' ),
					UPLOAD_ERR_CANT_WRITE => __( 'The server could not write the file to disk.', 'easy-file-manager' ),
				);
				throw new Fivelle_FE_Exception( isset( $codes[ $file['error'] ] ) ? $codes[ $file['error'] ] : __( 'Upload failed.', 'easy-file-manager' ) );
			}
			if ( empty( $file['tmp_name'] ) || ! is_uploaded_file( $file['tmp_name'] ) ) {
				throw new Fivelle_FE_Exception( __( 'Upload failed.', 'easy-file-manager' ) );
			}

			$relpath  = (string) self::arg( 'relpath' );
			$segments = array_values(
				array_filter(
					explode( '/', str_replace( '\\', '/', '' !== $relpath ? $relpath : (string) $file['name'] ) ),
					'strlen'
				)
			);
			if ( empty( $segments ) ) {
				throw new Fivelle_FE_Exception( __( 'Invalid file name.', 'easy-file-manager' ) );
			}
			$name = array_pop( $segments );

			// Re-create dropped folder structure.
			foreach ( $segments as $seg ) {
				$next = $fs->child( $dir, $seg );
				if ( ! is_dir( $next ) && ! @mkdir( $next, 0755 ) ) { // phpcs:ignore
					throw new Fivelle_FE_Exception( __( 'Could not create a folder for the upload.', 'easy-file-manager' ) );
				}
				$dir = realpath( $next );
				if ( false === $dir || ! $fs->inside( $dir ) ) {
					throw new Fivelle_FE_Exception( __( 'Access denied.', 'easy-file-manager' ) );
				}
			}

			$fs->child( $dir, $name ); // Validates the name.
			if ( ! self::arg_bool( 'overwrite' ) ) {
				$name = $fs->unique_name( $dir, $name );
			}
			$target = $dir . DIRECTORY_SEPARATOR . $name;
			if ( is_dir( $target ) ) {
				throw new Fivelle_FE_Exception( __( 'A folder with this name already exists.', 'easy-file-manager' ) );
			}
			if ( ! @move_uploaded_file( $file['tmp_name'], $target ) ) { // phpcs:ignore
				throw new Fivelle_FE_Exception( __( 'The file could not be saved. Check folder permissions.', 'easy-file-manager' ) );
			}
			@chmod( $target, 0644 ); // phpcs:ignore
			$rel = $fs->rel( $target );
			Fivelle_FE_Logger::add( 'upload', $rel, size_format( (int) $file['size'] ) );
			wp_send_json_success( array( 'path' => $rel ) );
		} catch ( Fivelle_FE_Exception $e ) {
			self::fail( $e->getMessage() );
		} catch ( Throwable $e ) {
			self::fail( $e->getMessage(), 500 );
		}
	}

	/**
	 * Stream a file for preview or download.
	 * Inline display is only allowed for safe media types, under a locked-down CSP.
	 */
	public static function raw() {
		self::guard( false );
		try {
			$fs  = Fivelle_FE_Plugin::fs();
			$abs = $fs->resolve( self::arg( 'path' ) );
		} catch ( Fivelle_FE_Exception $e ) {
			wp_die( esc_html( $e->getMessage() ), '', array( 'response' => 404 ) );
		}
		if ( is_dir( $abs ) || ! is_readable( $abs ) ) {
			wp_die( esc_html__( 'This file cannot be read.', 'easy-file-manager' ), '', array( 'response' => 403 ) );
		}

		$mime   = Fivelle_FE_Filesystem::mime_for( $abs );
		$inline = ! self::arg_bool( 'dl' ) && preg_match( '#^(image|video|audio)/|^application/pdf$#', $mime );

		if ( self::arg_bool( 'dl' ) ) {
			Fivelle_FE_Logger::add( 'download', $fs->rel( $abs ) );
		}
		self::send_file( $abs, basename( $abs ), $inline ? $mime : 'application/octet-stream', $inline );
	}

	/**
	 * Zip the selection to a temp file and stream it.
	 */
	public static function zip_download() {
		self::guard( false );
		try {
			$fs    = Fivelle_FE_Plugin::fs();
			$items = array();
			foreach ( self::arg_paths() as $rel ) {
				$items[] = $fs->resolve( $rel );
			}
			$name = ( 1 === count( $items ) ) ? basename( $items[0] ) : 'files-' . gmdate( 'Ymd-His' );
			if ( '' === $name ) {
				$name = 'site';
			}
			$tmp = wp_tempnam( 'fivelle-zip' );
			$fs->compress( $items, $tmp );
			Fivelle_FE_Logger::add( 'download', implode( ', ', array_map( array( $fs, 'rel' ), $items ) ), 'zip' );
		} catch ( Fivelle_FE_Exception $e ) {
			wp_die( esc_html( $e->getMessage() ) );
		}
		self::send_file( $tmp, $name . '.zip', 'application/zip', false, true );
	}

	/**
	 * Output a file with safe headers.
	 *
	 * @param string $abs    File.
	 * @param string $name   Download name.
	 * @param string $mime   Content type.
	 * @param bool   $inline Inline or attachment.
	 * @param bool   $unlink Delete after sending.
	 */
	private static function send_file( $abs, $name, $mime, $inline, $unlink = false ) {
		while ( ob_get_level() ) {
			ob_end_clean();
		}
		$ascii = preg_replace( '/[^\x20-\x7E]|["\\\\]/', '_', $name );
		nocache_headers();
		header( 'Content-Type: ' . $mime );
		header( 'Content-Length: ' . filesize( $abs ) );
		header( 'X-Content-Type-Options: nosniff' );
		header( 'Content-Disposition: ' . ( $inline ? 'inline' : 'attachment' ) . '; filename="' . $ascii . '"; filename*=UTF-8\'\'' . rawurlencode( $name ) );
		if ( 'application/pdf' !== $mime ) {
			// PDFs are left without CSP so the browser's built-in viewer can render them.
			header( "Content-Security-Policy: default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox" );
		}
		$h = fopen( $abs, 'rb' ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		if ( $h ) {
			while ( ! feof( $h ) ) {
				echo fread( $h, 1048576 ); // phpcs:ignore WordPress.Security.EscapeOutput, WordPress.WP.AlternativeFunctions
				flush();
			}
			fclose( $h ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		}
		if ( $unlink ) {
			@unlink( $abs ); // phpcs:ignore
		}
		exit;
	}
}
