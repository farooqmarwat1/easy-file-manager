<?php
/**
 * Sandboxed filesystem layer. Every path from the browser is relative to the
 * configured root and is resolved here; nothing outside the root is reachable.
 *
 * @package EasyFileManager
 */

defined( 'ABSPATH' ) || exit;

/**
 * Error shown to the user.
 */
class Fivelle_FE_Exception extends Exception {}

/**
 * Filesystem operations jailed to a root folder.
 */
class Fivelle_FE_Filesystem {

	/**
	 * Real path of the root folder.
	 *
	 * @var string
	 */
	private $root;

	/**
	 * Root with a trailing separator.
	 *
	 * @var string
	 */
	private $prefix;

	/**
	 * Case-insensitive filesystem (Windows).
	 *
	 * @var bool
	 */
	private $ci;

	/**
	 * Constructor.
	 *
	 * @param string $root Root folder.
	 * @throws Fivelle_FE_Exception When the root is missing.
	 */
	public function __construct( $root ) {
		$real = realpath( $root );
		if ( false === $real || ! is_dir( $real ) ) {
			throw new Fivelle_FE_Exception( __( 'The configured root folder does not exist. Check File Manager → Settings.', 'easy-file-manager' ) );
		}
		$this->root   = $real;
		$this->prefix = rtrim( $real, '/\\' ) . DIRECTORY_SEPARATOR;
		$this->ci     = ( 'WIN' === strtoupper( substr( PHP_OS, 0, 3 ) ) );
	}

	/**
	 * Root real path.
	 *
	 * @return string
	 */
	public function root() {
		return $this->root;
	}

	/* --------------------------------------------------------------------- */
	/* Path handling                                                          */
	/* --------------------------------------------------------------------- */

	/**
	 * Is $child the same as, or inside, $parent?
	 *
	 * @param string $child  Absolute path.
	 * @param string $parent Absolute path.
	 * @return bool
	 */
	public function is_within( $child, $parent ) {
		if ( $this->ci ) {
			$child  = strtolower( $child );
			$parent = strtolower( $parent );
		}
		$pre = rtrim( $parent, '/\\' ) . DIRECTORY_SEPARATOR;
		return $child === $parent || 0 === strpos( $child, $pre );
	}

	/**
	 * Is the absolute path inside the root?
	 *
	 * @param string $abs Absolute path.
	 * @return bool
	 */
	public function inside( $abs ) {
		return $this->is_within( $abs, $this->root );
	}

	/**
	 * Absolute path → path relative to root using forward slashes.
	 *
	 * @param string $abs Absolute path.
	 * @return string
	 */
	public function rel( $abs ) {
		if ( $this->ci ? strtolower( $abs ) === strtolower( $this->root ) : $abs === $this->root ) {
			return '';
		}
		return str_replace( DIRECTORY_SEPARATOR, '/', substr( $abs, strlen( $this->prefix ) ) );
	}

	/**
	 * Split a relative path into safe segments.
	 *
	 * @param string $rel Relative path.
	 * @return string[]
	 * @throws Fivelle_FE_Exception On traversal attempts.
	 */
	private function segments( $rel ) {
		$rel = (string) $rel;
		if ( false !== strpos( $rel, "\0" ) ) {
			throw new Fivelle_FE_Exception( __( 'Invalid path.', 'easy-file-manager' ) );
		}
		$out = array();
		foreach ( explode( '/', str_replace( '\\', '/', $rel ) ) as $seg ) {
			if ( '' === $seg || '.' === $seg ) {
				continue;
			}
			if ( '..' === $seg ) {
				throw new Fivelle_FE_Exception( __( 'Invalid path.', 'easy-file-manager' ) );
			}
			$out[] = $seg;
		}
		return $out;
	}

	/**
	 * Resolve an existing relative path to a real absolute path inside the root.
	 *
	 * @param string $rel Relative path.
	 * @return string
	 * @throws Fivelle_FE_Exception When missing or outside the root.
	 */
	public function resolve( $rel ) {
		$parts = $this->segments( $rel );
		$abs   = $this->root . ( $parts ? DIRECTORY_SEPARATOR . implode( DIRECTORY_SEPARATOR, $parts ) : '' );
		$real  = realpath( $abs );

		if ( false === $real ) {
			throw new Fivelle_FE_Exception( __( 'File or folder not found.', 'easy-file-manager' ) );
		}
		if ( ! $this->inside( $real ) ) {
			throw new Fivelle_FE_Exception( __( 'Access denied: this location is outside the allowed folder.', 'easy-file-manager' ) );
		}
		return $real;
	}

	/**
	 * Resolve an existing folder.
	 *
	 * @param string $rel Relative path.
	 * @return string
	 * @throws Fivelle_FE_Exception When not a folder.
	 */
	public function resolve_dir( $rel ) {
		$abs = $this->resolve( $rel );
		if ( ! is_dir( $abs ) ) {
			throw new Fivelle_FE_Exception( __( 'This is not a folder.', 'easy-file-manager' ) );
		}
		return $abs;
	}

	/**
	 * Validate a single file or folder name.
	 *
	 * @param string $name Name.
	 * @return bool
	 */
	public static function valid_name( $name ) {
		$name = (string) $name;
		if ( '' === trim( $name ) || '.' === $name || '..' === $name || strlen( $name ) > 255 ) {
			return false;
		}
		return ! preg_match( '#[/\\\\<>:"|?*\x00-\x1F]#', $name );
	}

	/**
	 * Build the absolute path for a new child of an existing folder.
	 *
	 * @param string $dir  Absolute, resolved folder.
	 * @param string $name Child name.
	 * @return string
	 * @throws Fivelle_FE_Exception When the name is invalid.
	 */
	public function child( $dir, $name ) {
		$name = trim( (string) $name );
		if ( ! self::valid_name( $name ) ) {
			throw new Fivelle_FE_Exception( __( 'Please use a valid name. These characters are not allowed: / \\ < > : " | ? *', 'easy-file-manager' ) );
		}
		return rtrim( $dir, '/\\' ) . DIRECTORY_SEPARATOR . $name;
	}

	/**
	 * Find a free name in a folder: "photo.jpg" → "photo (1).jpg".
	 *
	 * @param string $dir  Absolute folder.
	 * @param string $name Desired name.
	 * @return string
	 */
	public function unique_name( $dir, $name ) {
		$dir = rtrim( $dir, '/\\' ) . DIRECTORY_SEPARATOR;
		if ( ! file_exists( $dir . $name ) && ! is_link( $dir . $name ) ) {
			return $name;
		}
		$dot  = strrpos( $name, '.' );
		$base = ( $dot > 0 ) ? substr( $name, 0, $dot ) : $name;
		$ext  = ( $dot > 0 ) ? substr( $name, $dot ) : '';
		$i    = 1;
		do {
			$try = $base . ' (' . $i . ')' . $ext;
			++$i;
		} while ( file_exists( $dir . $try ) || is_link( $dir . $try ) );
		return $try;
	}

	/* --------------------------------------------------------------------- */
	/* Reading                                                                */
	/* --------------------------------------------------------------------- */

	/**
	 * Describe one entry.
	 *
	 * @param string $abs  Absolute path.
	 * @param string $rel  Relative path.
	 * @param string $name Base name.
	 * @return array
	 */
	public function entry( $abs, $rel, $name ) {
		$is_link = is_link( $abs );
		$is_dir  = is_dir( $abs );
		$st      = @stat( $abs ); // phpcs:ignore WordPress.PHP.NoSilencedErrors
		if ( ! $st ) {
			$st = @lstat( $abs ); // phpcs:ignore WordPress.PHP.NoSilencedErrors
		}
		return array(
			'name'   => $name,
			'path'   => $rel,
			'dir'    => $is_dir,
			'ext'    => $is_dir ? '' : strtolower( (string) pathinfo( $name, PATHINFO_EXTENSION ) ),
			'size'   => $is_dir ? null : ( $st ? (int) $st['size'] : 0 ),
			'mtime'  => $st ? (int) $st['mtime'] : 0,
			'perms'  => $st ? substr( sprintf( '%o', $st['mode'] ), -4 ) : '----',
			'w'      => is_writable( $abs ),
			'link'   => $is_link,
			'hidden' => '.' === substr( $name, 0, 1 ),
		);
	}

	/**
	 * List a folder.
	 *
	 * @param string $abs         Absolute folder.
	 * @param bool   $show_hidden Include dot-files.
	 * @param bool   $dirs_only   Only folders (for the tree).
	 * @param int    $limit       Max entries.
	 * @return array
	 * @throws Fivelle_FE_Exception When unreadable.
	 */
	public function list_dir( $abs, $show_hidden = true, $dirs_only = false, $limit = 10000 ) {
		if ( ! is_readable( $abs ) ) {
			throw new Fivelle_FE_Exception( __( 'This folder cannot be read (permission denied).', 'easy-file-manager' ) );
		}
		$h = @opendir( $abs ); // phpcs:ignore WordPress.PHP.NoSilencedErrors
		if ( ! $h ) {
			throw new Fivelle_FE_Exception( __( 'This folder cannot be opened.', 'easy-file-manager' ) );
		}
		$base      = $this->rel( $abs );
		$base      = '' === $base ? '' : $base . '/';
		$items     = array();
		$truncated = false;
		while ( false !== ( $name = readdir( $h ) ) ) { // phpcs:ignore WordPress.CodeAnalysis.AssignmentInCondition
			if ( '.' === $name || '..' === $name ) {
				continue;
			}
			if ( ! $show_hidden && '.' === $name[0] ) {
				continue;
			}
			$path = $abs . DIRECTORY_SEPARATOR . $name;
			if ( $dirs_only && ! is_dir( $path ) ) {
				continue;
			}
			if ( count( $items ) >= $limit ) {
				$truncated = true;
				break;
			}
			$items[] = $this->entry( $path, $base . $name, $name );
		}
		closedir( $h );
		return array(
			'items'     => $items,
			'truncated' => $truncated,
		);
	}

	/**
	 * Detailed information about one entry.
	 *
	 * @param string $abs Absolute path.
	 * @return array
	 */
	public function info( $abs ) {
		$name = basename( $abs );
		$info = $this->entry( $abs, $this->rel( $abs ), $name );
		$st   = @stat( $abs ); // phpcs:ignore WordPress.PHP.NoSilencedErrors

		$info['abs']      = $abs;
		$info['ctime']    = $st ? (int) $st['ctime'] : 0;
		$info['atime']    = $st ? (int) $st['atime'] : 0;
		$info['readable'] = is_readable( $abs );
		$info['owner']    = $this->owner_name( $st ? $st['uid'] : null, 'user' );
		$info['group']    = $this->owner_name( $st ? $st['gid'] : null, 'group' );
		$info['mime']     = $info['dir'] ? 'inode/directory' : self::mime_for( $abs );
		$info['url']      = $this->public_url( $abs );

		if ( $info['dir'] ) {
			$files = 0;
			$dirs  = 0;
			try {
				foreach ( new FilesystemIterator( $abs, FilesystemIterator::SKIP_DOTS ) as $f ) {
					if ( $f->isDir() ) {
						++$dirs;
					} else {
						++$files;
					}
					if ( $files + $dirs >= 20000 ) {
						break;
					}
				}
			} catch ( Exception $e ) {
				unset( $e );
			}
			$info['files']   = $files;
			$info['folders'] = $dirs;
		} elseif ( 0 === strpos( $info['mime'], 'image/' ) && 'image/svg+xml' !== $info['mime'] && $info['size'] < 30 * MB_IN_BYTES ) {
			$dims = @getimagesize( $abs ); // phpcs:ignore WordPress.PHP.NoSilencedErrors
			if ( $dims ) {
				$info['width']  = (int) $dims[0];
				$info['height'] = (int) $dims[1];
			}
		}
		return $info;
	}

	/**
	 * Resolve a uid/gid to a name when POSIX is available.
	 *
	 * @param int|null $id   ID.
	 * @param string   $kind user|group.
	 * @return string
	 */
	private function owner_name( $id, $kind ) {
		if ( null === $id ) {
			return '';
		}
		if ( 'user' === $kind && function_exists( 'posix_getpwuid' ) ) {
			$p = @posix_getpwuid( $id ); // phpcs:ignore WordPress.PHP.NoSilencedErrors
			if ( $p && isset( $p['name'] ) ) {
				return $p['name'] . ' (' . $id . ')';
			}
		}
		if ( 'group' === $kind && function_exists( 'posix_getgrgid' ) ) {
			$g = @posix_getgrgid( $id ); // phpcs:ignore WordPress.PHP.NoSilencedErrors
			if ( $g && isset( $g['name'] ) ) {
				return $g['name'] . ' (' . $id . ')';
			}
		}
		return (string) $id;
	}

	/**
	 * Public URL when the path lives inside the WordPress install.
	 *
	 * @param string $abs Absolute path.
	 * @return string
	 */
	public function public_url( $abs ) {
		$wp = realpath( ABSPATH );
		if ( $wp && $this->is_within( $abs, $wp ) ) {
			$rel = ltrim( str_replace( DIRECTORY_SEPARATOR, '/', substr( $abs, strlen( rtrim( $wp, '/\\' ) ) ) ), '/' );
			return site_url( implode( '/', array_map( 'rawurlencode', explode( '/', $rel ) ) ) );
		}
		return '';
	}

	/**
	 * Total size of a folder (time-boxed).
	 *
	 * @param string $abs Absolute folder.
	 * @return array
	 */
	public function dir_size( $abs ) {
		$size    = 0;
		$files   = 0;
		$dirs    = 0;
		$partial = false;
		$start   = microtime( true );
		try {
			$it = new RecursiveIteratorIterator(
				new RecursiveDirectoryIterator( $abs, FilesystemIterator::SKIP_DOTS ),
				RecursiveIteratorIterator::SELF_FIRST,
				RecursiveIteratorIterator::CATCH_GET_CHILD
			);
			foreach ( $it as $f ) {
				if ( $f->isLink() ) {
					continue;
				}
				if ( $f->isDir() ) {
					++$dirs;
				} else {
					++$files;
					$size += (int) $f->getSize();
				}
				if ( 0 === ( ( $files + $dirs ) % 500 ) && microtime( true ) - $start > 8 ) {
					$partial = true;
					break;
				}
			}
		} catch ( Exception $e ) {
			$partial = true;
		}
		return compact( 'size', 'files', 'dirs', 'partial' );
	}

	/**
	 * Recursive name search below a folder.
	 *
	 * @param string $abs         Absolute folder.
	 * @param string $query       Search text.
	 * @param bool   $show_hidden Include dot-files.
	 * @return array
	 */
	public function search( $abs, $query, $show_hidden ) {
		$query   = function_exists( 'mb_strtolower' ) ? mb_strtolower( $query ) : strtolower( $query );
		$results = array();
		$scanned = 0;
		$partial = false;
		$start   = microtime( true );

		$dir_it = new RecursiveDirectoryIterator( $abs, FilesystemIterator::SKIP_DOTS );
		$filter = new RecursiveCallbackFilterIterator(
			$dir_it,
			function ( $current ) use ( $show_hidden ) {
				return $show_hidden || '.' !== substr( $current->getFilename(), 0, 1 );
			}
		);
		$it = new RecursiveIteratorIterator( $filter, RecursiveIteratorIterator::SELF_FIRST, RecursiveIteratorIterator::CATCH_GET_CHILD );

		try {
			foreach ( $it as $f ) {
				++$scanned;
				$name = $f->getFilename();
				$hay  = function_exists( 'mb_strtolower' ) ? mb_strtolower( $name ) : strtolower( $name );
				if ( false !== strpos( $hay, $query ) ) {
					$p         = $f->getPathname();
					$results[] = $this->entry( $p, $this->rel( $p ), $name );
					if ( count( $results ) >= 500 ) {
						$partial = true;
						break;
					}
				}
				if ( $scanned >= 200000 || ( 0 === $scanned % 1000 && microtime( true ) - $start > 10 ) ) {
					$partial = true;
					break;
				}
			}
		} catch ( Exception $e ) {
			$partial = true;
		}
		return array(
			'items'   => $results,
			'partial' => $partial,
			'scanned' => $scanned,
		);
	}

	/**
	 * Read a text file for the editor.
	 *
	 * @param string $abs    Absolute file.
	 * @param int    $max_kb Size limit.
	 * @return array
	 * @throws Fivelle_FE_Exception When not editable.
	 */
	public function read_text( $abs, $max_kb ) {
		if ( is_dir( $abs ) ) {
			throw new Fivelle_FE_Exception( __( 'Folders cannot be opened in the editor.', 'easy-file-manager' ) );
		}
		if ( ! is_readable( $abs ) ) {
			throw new Fivelle_FE_Exception( __( 'This file cannot be read (permission denied).', 'easy-file-manager' ) );
		}
		$size = (int) filesize( $abs );
		if ( $size > $max_kb * KB_IN_BYTES ) {
			/* translators: %s: size limit */
			throw new Fivelle_FE_Exception( sprintf( __( 'This file is larger than the editor limit (%s). Download it instead.', 'easy-file-manager' ), size_format( $max_kb * KB_IN_BYTES ) ) );
		}
		$content = file_get_contents( $abs ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		if ( false === $content ) {
			throw new Fivelle_FE_Exception( __( 'This file could not be read.', 'easy-file-manager' ) );
		}
		if ( false !== strpos( substr( $content, 0, 8000 ), "\0" ) ) {
			throw new Fivelle_FE_Exception( __( 'This looks like a binary file and cannot be edited as text.', 'easy-file-manager' ) );
		}
		$utf8 = function_exists( 'mb_check_encoding' ) ? mb_check_encoding( $content, 'UTF-8' ) : seems_utf8( $content );
		if ( ! $utf8 ) {
			throw new Fivelle_FE_Exception( __( 'This file is not UTF-8 text, so it cannot be edited safely here.', 'easy-file-manager' ) );
		}
		return array(
			'content' => $content,
			'mtime'   => (int) filemtime( $abs ),
			'size'    => $size,
			'w'       => is_writable( $abs ),
		);
	}

	/**
	 * Map of extensions to MIME types used for previews and downloads.
	 *
	 * @param string $abs File path.
	 * @return string
	 */
	public static function mime_for( $abs ) {
		$ext = strtolower( (string) pathinfo( $abs, PATHINFO_EXTENSION ) );
		$map = array(
			'jpg'  => 'image/jpeg',
			'jpeg' => 'image/jpeg',
			'png'  => 'image/png',
			'gif'  => 'image/gif',
			'webp' => 'image/webp',
			'avif' => 'image/avif',
			'bmp'  => 'image/bmp',
			'ico'  => 'image/x-icon',
			'svg'  => 'image/svg+xml',
			'mp4'  => 'video/mp4',
			'm4v'  => 'video/mp4',
			'webm' => 'video/webm',
			'ogv'  => 'video/ogg',
			'mov'  => 'video/quicktime',
			'mp3'  => 'audio/mpeg',
			'wav'  => 'audio/wav',
			'ogg'  => 'audio/ogg',
			'oga'  => 'audio/ogg',
			'm4a'  => 'audio/mp4',
			'flac' => 'audio/flac',
			'pdf'  => 'application/pdf',
			'zip'  => 'application/zip',
			'json' => 'application/json',
			'txt'  => 'text/plain',
		);
		if ( isset( $map[ $ext ] ) ) {
			return $map[ $ext ];
		}
		$wp = wp_check_filetype( basename( $abs ) );
		return ! empty( $wp['type'] ) ? $wp['type'] : 'application/octet-stream';
	}

	/* --------------------------------------------------------------------- */
	/* Writing                                                                */
	/* --------------------------------------------------------------------- */

	/**
	 * Create a folder.
	 *
	 * @param string $dir  Parent (absolute).
	 * @param string $name Folder name.
	 * @return string New absolute path.
	 * @throws Fivelle_FE_Exception On failure.
	 */
	public function mkdir( $dir, $name ) {
		$path = $this->child( $dir, $name );
		if ( file_exists( $path ) ) {
			throw new Fivelle_FE_Exception( __( 'An item with this name already exists.', 'easy-file-manager' ) );
		}
		if ( ! @mkdir( $path, 0755 ) ) { // phpcs:ignore
			throw new Fivelle_FE_Exception( __( 'The folder could not be created. Check folder permissions.', 'easy-file-manager' ) );
		}
		return $path;
	}

	/**
	 * Create an empty file.
	 *
	 * @param string $dir     Parent (absolute).
	 * @param string $name    File name.
	 * @param string $content Initial content.
	 * @return string New absolute path.
	 * @throws Fivelle_FE_Exception On failure.
	 */
	public function mkfile( $dir, $name, $content = '' ) {
		$path = $this->child( $dir, $name );
		$h    = @fopen( $path, 'x' ); // phpcs:ignore
		if ( ! $h ) {
			if ( file_exists( $path ) ) {
				throw new Fivelle_FE_Exception( __( 'An item with this name already exists.', 'easy-file-manager' ) );
			}
			throw new Fivelle_FE_Exception( __( 'The file could not be created. Check folder permissions.', 'easy-file-manager' ) );
		}
		fwrite( $h, $content ); // phpcs:ignore
		fclose( $h ); // phpcs:ignore
		return $path;
	}

	/**
	 * Rename in place.
	 *
	 * @param string $abs  Item (absolute).
	 * @param string $name New name.
	 * @return string New absolute path.
	 * @throws Fivelle_FE_Exception On failure.
	 */
	public function rename( $abs, $name ) {
		$this->guard_root( $abs );
		$dest = $this->child( dirname( $abs ), $name );
		if ( $dest === $abs ) {
			return $abs;
		}
		$case_only = $this->ci && strtolower( $dest ) === strtolower( $abs );
		if ( ! $case_only && ( file_exists( $dest ) || is_link( $dest ) ) ) {
			throw new Fivelle_FE_Exception( __( 'An item with this name already exists.', 'easy-file-manager' ) );
		}
		if ( ! @rename( $abs, $dest ) ) { // phpcs:ignore
			throw new Fivelle_FE_Exception( __( 'The item could not be renamed. Check permissions.', 'easy-file-manager' ) );
		}
		return $dest;
	}

	/**
	 * Refuse to touch the root folder itself.
	 *
	 * @param string $abs Absolute path.
	 * @throws Fivelle_FE_Exception When it is the root.
	 */
	private function guard_root( $abs ) {
		if ( $this->rel( $abs ) === '' ) {
			throw new Fivelle_FE_Exception( __( 'The root folder cannot be changed.', 'easy-file-manager' ) );
		}
	}

	/**
	 * Delete a file or folder (recursively).
	 *
	 * @param string $abs Absolute path.
	 * @throws Fivelle_FE_Exception On failure.
	 */
	public function delete( $abs ) {
		$this->guard_root( $abs );
		if ( is_link( $abs ) || ! is_dir( $abs ) ) {
			if ( ! @unlink( $abs ) && ! ( is_link( $abs ) && @rmdir( $abs ) ) ) { // phpcs:ignore
				/* translators: %s: file name */
				throw new Fivelle_FE_Exception( sprintf( __( 'Could not delete %s.', 'easy-file-manager' ), basename( $abs ) ) );
			}
			return;
		}
		$it = new RecursiveIteratorIterator(
			new RecursiveDirectoryIterator( $abs, FilesystemIterator::SKIP_DOTS ),
			RecursiveIteratorIterator::CHILD_FIRST
		);
		foreach ( $it as $f ) {
			$p = $f->getPathname();
			if ( $f->isLink() || ! $f->isDir() ) {
				$ok = @unlink( $p ) || @rmdir( $p ); // phpcs:ignore
			} else {
				$ok = @rmdir( $p ); // phpcs:ignore
			}
			if ( ! $ok ) {
				/* translators: %s: path */
				throw new Fivelle_FE_Exception( sprintf( __( 'Could not delete %s. Check permissions.', 'easy-file-manager' ), $this->rel( $p ) ) );
			}
		}
		if ( ! @rmdir( $abs ) ) { // phpcs:ignore
			/* translators: %s: folder name */
			throw new Fivelle_FE_Exception( sprintf( __( 'Could not delete %s.', 'easy-file-manager' ), basename( $abs ) ) );
		}
	}

	/**
	 * Copy a file or folder (recursively). Symlinked folders are skipped.
	 *
	 * @param string $src  Source (absolute).
	 * @param string $dest Destination (absolute, must not exist).
	 * @throws Fivelle_FE_Exception On failure.
	 */
	public function copy_item( $src, $dest ) {
		if ( is_dir( $src ) ) {
			if ( is_link( $src ) ) {
				return;
			}
			if ( $this->is_within( $dest, $src ) ) {
				throw new Fivelle_FE_Exception( __( 'A folder cannot be copied into itself.', 'easy-file-manager' ) );
			}
			if ( ! @mkdir( $dest, 0755 ) ) { // phpcs:ignore
				throw new Fivelle_FE_Exception( __( 'Could not create the destination folder.', 'easy-file-manager' ) );
			}
			foreach ( new FilesystemIterator( $src, FilesystemIterator::SKIP_DOTS ) as $f ) {
				$this->copy_item( $f->getPathname(), $dest . DIRECTORY_SEPARATOR . $f->getFilename() );
			}
			return;
		}
		if ( ! @copy( $src, $dest ) ) { // phpcs:ignore
			/* translators: %s: file name */
			throw new Fivelle_FE_Exception( sprintf( __( 'Could not copy %s.', 'easy-file-manager' ), basename( $src ) ) );
		}
	}

	/**
	 * Move a file or folder.
	 *
	 * @param string $src  Source (absolute).
	 * @param string $dest Destination (absolute, must not exist).
	 * @throws Fivelle_FE_Exception On failure.
	 */
	public function move_item( $src, $dest ) {
		$this->guard_root( $src );
		if ( is_dir( $src ) && ! is_link( $src ) && $this->is_within( $dest, $src ) ) {
			throw new Fivelle_FE_Exception( __( 'A folder cannot be moved into itself.', 'easy-file-manager' ) );
		}
		if ( @rename( $src, $dest ) ) { // phpcs:ignore
			return;
		}
		// Cross-device fallback.
		$this->copy_item( $src, $dest );
		$this->delete( $src );
	}

	/**
	 * Save text content.
	 *
	 * @param string $abs     Absolute file.
	 * @param string $content Content.
	 * @throws Fivelle_FE_Exception On failure.
	 */
	public function write_text( $abs, $content ) {
		if ( is_dir( $abs ) || ! is_writable( $abs ) ) {
			throw new Fivelle_FE_Exception( __( 'This file is not writable. Check its permissions.', 'easy-file-manager' ) );
		}
		if ( false === file_put_contents( $abs, $content, LOCK_EX ) ) { // phpcs:ignore WordPress.WP.AlternativeFunctions
			throw new Fivelle_FE_Exception( __( 'The file could not be saved.', 'easy-file-manager' ) );
		}
		clearstatcache( true, $abs );
	}

	/**
	 * Change permissions.
	 *
	 * @param string $abs  Absolute path.
	 * @param string $mode Octal string, e.g. 0644.
	 * @throws Fivelle_FE_Exception On failure.
	 */
	public function chmod( $abs, $mode ) {
		if ( ! preg_match( '/^[0-7]{3,4}$/', (string) $mode ) ) {
			throw new Fivelle_FE_Exception( __( 'Permissions must be an octal value like 644 or 0755.', 'easy-file-manager' ) );
		}
		if ( ! @chmod( $abs, octdec( $mode ) ) ) { // phpcs:ignore
			throw new Fivelle_FE_Exception( __( 'Permissions could not be changed. The web server may not own this file.', 'easy-file-manager' ) );
		}
		clearstatcache( true, $abs );
	}

	/**
	 * Zip a list of items into a new archive.
	 *
	 * @param string[] $items Absolute paths.
	 * @param string   $zip   Archive path.
	 * @throws Fivelle_FE_Exception On failure.
	 */
	public function compress( array $items, $zip ) {
		if ( ! class_exists( 'ZipArchive' ) ) {
			throw new Fivelle_FE_Exception( __( 'The PHP Zip extension is not installed on this server.', 'easy-file-manager' ) );
		}
		$za = new ZipArchive();
		if ( true !== $za->open( $zip, ZipArchive::CREATE | ZipArchive::OVERWRITE ) ) {
			throw new Fivelle_FE_Exception( __( 'The archive could not be created.', 'easy-file-manager' ) );
		}
		foreach ( $items as $abs ) {
			$base = basename( $abs );
			if ( is_dir( $abs ) && ! is_link( $abs ) ) {
				$za->addEmptyDir( $base );
				$it = new RecursiveIteratorIterator(
					new RecursiveDirectoryIterator( $abs, FilesystemIterator::SKIP_DOTS ),
					RecursiveIteratorIterator::SELF_FIRST,
					RecursiveIteratorIterator::CATCH_GET_CHILD
				);
				foreach ( $it as $f ) {
					$p     = $f->getPathname();
					$local = $base . '/' . str_replace( DIRECTORY_SEPARATOR, '/', substr( $p, strlen( $abs ) + 1 ) );
					if ( $f->isLink() && $f->isDir() ) {
						continue;
					}
					if ( $f->isDir() ) {
						$za->addEmptyDir( $local );
					} elseif ( $f->isReadable() && realpath( $p ) !== realpath( $zip ) ) {
						$za->addFile( $p, $local );
					}
				}
			} elseif ( is_file( $abs ) && is_readable( $abs ) ) {
				$za->addFile( $abs, $base );
			}
		}
		if ( ! $za->close() ) {
			throw new Fivelle_FE_Exception( __( 'The archive could not be written.', 'easy-file-manager' ) );
		}
	}

	/**
	 * Safely extract an archive (blocks "zip slip" entries).
	 *
	 * @param string $zip  Archive (absolute).
	 * @param string $dest Destination folder (absolute, will be created).
	 * @return int Number of extracted files.
	 * @throws Fivelle_FE_Exception On failure.
	 */
	public function extract( $zip, $dest ) {
		if ( ! class_exists( 'ZipArchive' ) ) {
			throw new Fivelle_FE_Exception( __( 'The PHP Zip extension is not installed on this server.', 'easy-file-manager' ) );
		}
		$za = new ZipArchive();
		if ( true !== $za->open( $zip ) ) {
			throw new Fivelle_FE_Exception( __( 'This archive could not be opened. It may be damaged.', 'easy-file-manager' ) );
		}
		if ( ! is_dir( $dest ) && ! wp_mkdir_p( $dest ) ) {
			$za->close();
			throw new Fivelle_FE_Exception( __( 'Could not create the destination folder.', 'easy-file-manager' ) );
		}
		$count = 0;
		for ( $i = 0; $i < $za->numFiles; $i++ ) { // phpcs:ignore WordPress.NamingConventions.ValidVariableName
			$name = $za->getNameIndex( $i );
			$n    = str_replace( '\\', '/', (string) $name );
			if ( '' === $n || '/' === $n[0] || false !== strpos( $n, "\0" ) || preg_match( '#(^|/)\.\.(/|$)#', $n ) || preg_match( '#^[a-zA-Z]:#', $n ) ) {
				continue; // Unsafe entry.
			}
			$target = $dest . DIRECTORY_SEPARATOR . str_replace( '/', DIRECTORY_SEPARATOR, rtrim( $n, '/' ) );
			if ( '/' === substr( $n, -1 ) ) {
				wp_mkdir_p( $target );
				continue;
			}
			wp_mkdir_p( dirname( $target ) );
			$in  = $za->getStream( $name );
			$out = @fopen( $target, 'wb' ); // phpcs:ignore
			if ( $in && $out ) {
				stream_copy_to_stream( $in, $out );
				++$count;
			}
			if ( $in ) {
				fclose( $in ); // phpcs:ignore
			}
			if ( $out ) {
				fclose( $out ); // phpcs:ignore
			}
		}
		$za->close();
		return $count;
	}

	/**
	 * Disk usage of the volume holding the root.
	 *
	 * @return array
	 */
	public function disk() {
		$free  = function_exists( 'disk_free_space' ) ? @disk_free_space( $this->root ) : false; // phpcs:ignore
		$total = function_exists( 'disk_total_space' ) ? @disk_total_space( $this->root ) : false; // phpcs:ignore
		return array(
			'free'  => false === $free ? null : (float) $free,
			'total' => false === $total ? null : (float) $total,
		);
	}
}
