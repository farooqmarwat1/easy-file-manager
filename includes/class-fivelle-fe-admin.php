<?php
/**
 * Admin screens: Explorer, Activity Log and Settings.
 *
 * @package EasyFileManager
 */

defined( 'ABSPATH' ) || exit;

/**
 * Admin UI.
 */
class Fivelle_FE_Admin {

	const SLUG = 'fivelle-files';

	/**
	 * Register hooks.
	 */
	public static function init() {
		add_action( 'admin_menu', array( __CLASS__, 'menu' ) );
		add_action( 'admin_init', array( __CLASS__, 'register_settings' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue' ) );
		add_filter( 'admin_body_class', array( __CLASS__, 'body_class' ) );
		add_action( 'admin_post_fivelle_fe_clear_log', array( __CLASS__, 'clear_log' ) );
		add_filter( 'plugin_action_links_' . plugin_basename( FIVELLE_FE_FILE ), array( __CLASS__, 'action_links' ) );
		add_filter( 'plugin_row_meta', array( __CLASS__, 'row_meta' ), 10, 2 );
		add_filter( 'admin_footer_text', array( __CLASS__, 'footer_text' ) );
	}

	/**
	 * Link to the Fivelle website, tagged so visits from the plugin show up in analytics.
	 *
	 * @param string $where Where in the plugin the link is.
	 * @return string
	 */
	public static function fivelle_url( $where ) {
		return add_query_arg(
			array(
				'utm_source'   => 'easy-file-manager',
				'utm_medium'   => 'plugin',
				'utm_campaign' => sanitize_key( $where ),
			),
			FIVELLE_FE_SITE
		);
	}

	/**
	 * Extra links under the plugin description on the Plugins screen.
	 *
	 * @param array  $links Links.
	 * @param string $file  Plugin file.
	 * @return array
	 */
	public static function row_meta( $links, $file ) {
		if ( plugin_basename( FIVELLE_FE_FILE ) === $file ) {
			$links[] = '<a href="' . esc_url( self::fivelle_url( 'plugins-row' ) ) . '" target="_blank" rel="noopener">' . esc_html__( 'Visit Fivelle', 'easy-file-manager' ) . '</a>';
			$links[] = '<a href="' . esc_url( Fivelle_FE_Updater::repo_url() . '/issues' ) . '" target="_blank" rel="noopener">' . esc_html__( 'Support', 'easy-file-manager' ) . '</a>';
			$links[] = '<a href="' . esc_url( Fivelle_FE_Updater::repo_url() ) . '" target="_blank" rel="noopener">' . esc_html__( 'GitHub', 'easy-file-manager' ) . '</a>';
		}
		return $links;
	}

	/**
	 * "Developed by Fivelle" in the admin footer, on this plugin's screens only.
	 *
	 * @param string $text Footer text.
	 * @return string
	 */
	public static function footer_text( $text ) {
		if ( ! self::current_page() ) {
			return $text;
		}
		return sprintf(
			/* translators: %s: link to the Fivelle website */
			esc_html__( 'Easy File Manager is developed by %s.', 'easy-file-manager' ),
			'<a href="' . esc_url( self::fivelle_url( 'admin-footer' ) ) . '" target="_blank" rel="noopener"><strong>Fivelle</strong></a>'
		);
	}

	/**
	 * Is this one of our screens?
	 *
	 * @return string Page slug or ''.
	 */
	private static function current_page() {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$page = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : '';
		return 0 === strpos( $page, self::SLUG ) ? $page : '';
	}

	/**
	 * Menu icon (folder with an "F"), as a data URI WordPress can recolour.
	 *
	 * @return string
	 */
	private static function menu_icon() {
		$svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path fill="black" fill-rule="evenodd" d="M2 5.5A1.5 1.5 0 0 1 3.5 4h4l2 2h7A1.5 1.5 0 0 1 18 7.5v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 2 15.5zM8 9h4.2v1.3H9.5v1h2.3v1.3H9.5V15H8z"/></svg>';
		return 'data:image/svg+xml;base64,' . base64_encode( $svg ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions
	}

	/**
	 * Add menu pages.
	 */
	public static function menu() {
		if ( ! Fivelle_FE_Plugin::user_can() ) {
			return;
		}
		$cap = is_multisite() ? 'manage_network_options' : 'manage_options';

		add_menu_page(
			__( 'Easy File Manager', 'easy-file-manager' ),
			__( 'File Manager', 'easy-file-manager' ),
			$cap,
			self::SLUG,
			array( __CLASS__, 'render_explorer' ),
			self::menu_icon(),
			65
		);
		add_submenu_page( self::SLUG, __( 'File Manager', 'easy-file-manager' ), __( 'File Manager', 'easy-file-manager' ), $cap, self::SLUG, array( __CLASS__, 'render_explorer' ) );
		add_submenu_page( self::SLUG, __( 'Activity Log', 'easy-file-manager' ), __( 'Activity Log', 'easy-file-manager' ), $cap, self::SLUG . '-log', array( __CLASS__, 'render_log' ) );
		add_submenu_page( self::SLUG, __( 'Settings', 'easy-file-manager' ), __( 'Settings', 'easy-file-manager' ), $cap, self::SLUG . '-settings', array( __CLASS__, 'render_settings' ) );
	}

	/**
	 * "Open File Manager" / "Settings" links on the Plugins screen.
	 *
	 * @param array $links Links.
	 * @return array
	 */
	public static function action_links( $links ) {
		array_unshift(
			$links,
			'<a href="' . esc_url( admin_url( 'admin.php?page=' . self::SLUG ) ) . '">' . esc_html__( 'Open File Manager', 'easy-file-manager' ) . '</a>',
			'<a href="' . esc_url( admin_url( 'admin.php?page=' . self::SLUG . '-settings' ) ) . '">' . esc_html__( 'Settings', 'easy-file-manager' ) . '</a>'
		);
		return $links;
	}

	/**
	 * Body classes for full-height layout.
	 *
	 * @param string $classes Classes.
	 * @return string
	 */
	public static function body_class( $classes ) {
		$page = self::current_page();
		if ( $page ) {
			$classes .= ' fvl-screen';
			if ( self::SLUG === $page ) {
				$classes .= ' fvl-explorer-screen';
			}
		}
		return $classes;
	}

	/**
	 * Assets.
	 */
	public static function enqueue() {
		$page = self::current_page();
		if ( ! $page || ! Fivelle_FE_Plugin::user_can() ) {
			return;
		}
		wp_enqueue_style( 'fivelle-fe', FIVELLE_FE_URL . 'assets/css/explorer.css', array(), FIVELLE_FE_VERSION );

		if ( self::SLUG !== $page ) {
			wp_enqueue_script( 'fivelle-fe-admin', FIVELLE_FE_URL . 'assets/js/admin.js', array(), FIVELLE_FE_VERSION, true );
			return;
		}

		$code_editor = wp_enqueue_code_editor(
			array(
				'type'       => 'text/html',
				'codemirror' => array(
					'lint'         => false,
					'lineWrapping' => false,
				),
			)
		);

		wp_enqueue_script( 'fivelle-fe', FIVELLE_FE_URL . 'assets/js/explorer.js', array( 'jquery' ), FIVELLE_FE_VERSION, true );
		wp_add_inline_script( 'fivelle-fe', 'window.FivelleFE = ' . wp_json_encode( self::config( $code_editor ) ) . ';', 'before' );
	}

	/**
	 * Data passed to the JavaScript app.
	 *
	 * @param array|false $code_editor Code editor settings.
	 * @return array
	 */
	private static function config( $code_editor ) {
		$error = '';
		$quick = array();
		$root  = Fivelle_FE_Plugin::root_path();

		try {
			$fs   = Fivelle_FE_Plugin::fs();
			$root = $fs->root();

			$quick[] = array(
				'label' => __( 'Website root', 'easy-file-manager' ),
				'path'  => '',
				'icon'  => 'home',
			);
			$candidates = array(
				array( WP_CONTENT_DIR, __( 'wp-content', 'easy-file-manager' ), 'box' ),
				array( WP_PLUGIN_DIR, __( 'Plugins', 'easy-file-manager' ), 'plug' ),
				array( get_theme_root(), __( 'Themes', 'easy-file-manager' ), 'palette' ),
			);
			$uploads = wp_get_upload_dir();
			if ( ! empty( $uploads['basedir'] ) ) {
				$candidates[] = array( $uploads['basedir'], __( 'Uploads', 'easy-file-manager' ), 'image' );
			}
			foreach ( $candidates as $c ) {
				$real = realpath( $c[0] );
				if ( $real && $fs->inside( $real ) && $real !== $root ) {
					$quick[] = array(
						'label' => $c[1],
						'path'  => $fs->rel( $real ),
						'icon'  => $c[2],
					);
				}
			}
		} catch ( Fivelle_FE_Exception $e ) {
			$error = $e->getMessage();
		}

		$user = wp_get_current_user();

		return array(
			'ajax'        => admin_url( 'admin-ajax.php' ),
			'nonce'       => wp_create_nonce( 'fivelle_fe' ),
			'version'     => FIVELLE_FE_VERSION,
			'readOnly'    => Fivelle_FE_Plugin::read_only(),
			'showHidden'  => (bool) Fivelle_FE_Plugin::setting( 'show_hidden' ),
			'maxUpload'   => (int) wp_max_upload_size(),
			'editorMax'   => max( 64, (int) Fivelle_FE_Plugin::setting( 'editor_max_kb' ) ) * KB_IN_BYTES,
			'site'        => (string) wp_parse_url( home_url(), PHP_URL_HOST ),
			'siteName'    => get_bloginfo( 'name' ),
			'siteUrl'     => home_url( '/' ),
			'rootPath'    => $root,
			'rootName'    => basename( $root ),
			'quick'       => $quick,
			'settingsUrl' => admin_url( 'admin.php?page=' . self::SLUG . '-settings' ),
			'logUrl'      => admin_url( 'admin.php?page=' . self::SLUG . '-log' ),
			'brandUrl'    => self::fivelle_url( 'file-manager' ),
			'user'        => $user->display_name,
			'codeEditor'  => $code_editor ? $code_editor : false,
			'error'       => $error,
		);
	}

	/* --------------------------------------------------------------------- */
	/* Screens                                                                */
	/* --------------------------------------------------------------------- */

	/**
	 * Shared page header for Log / Settings.
	 *
	 * @param string $title    Title.
	 * @param string $subtitle Subtitle.
	 */
	private static function page_header( $title, $subtitle ) {
		?>
		<div class="fvl-page-head">
			<span class="fvl-logo" aria-hidden="true">
				<svg viewBox="0 0 32 32"><defs><linearGradient id="fvlg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6D5DFC"/><stop offset="1" stop-color="#B05CF6"/></linearGradient></defs><rect width="32" height="32" rx="9" fill="url(#fvlg)"/><path d="M7 11.5A2.5 2.5 0 0 1 9.5 9h4l2 2h7a2.5 2.5 0 0 1 2.5 2.5V21a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 7 21z" fill="#fff" opacity=".28"/><path d="M13 13.5h6.5v2h-4.2v1.6h3.6v2h-3.6v3.4H13z" fill="#fff"/></svg>
			</span>
			<div>
				<h1><?php echo esc_html( $title ); ?></h1>
				<p><?php echo esc_html( $subtitle ); ?></p>
			</div>
			<a class="fvl-btn fvl-btn-primary" href="<?php echo esc_url( admin_url( 'admin.php?page=' . self::SLUG ) ); ?>"><?php esc_html_e( 'Open File Manager', 'easy-file-manager' ); ?></a>
		</div>
		<hr class="wp-header-end">
		<?php
	}

	/**
	 * Explorer screen (the JS app mounts here).
	 */
	public static function render_explorer() {
		if ( ! Fivelle_FE_Plugin::user_can() ) {
			wp_die( esc_html__( 'You do not have permission to use the file explorer.', 'easy-file-manager' ) );
		}
		?>
		<div class="wrap fvl-wrap">
			<h1 class="screen-reader-text"><?php esc_html_e( 'Easy File Manager', 'easy-file-manager' ); ?></h1>
			<hr class="wp-header-end">
			<div id="fivelle-app" class="fvl-app" data-theme="light">
				<div class="fvl-boot"><span class="fvl-spinner"></span><?php esc_html_e( 'Loading Easy File Manager…', 'easy-file-manager' ); ?></div>
			</div>
			<noscript><p><?php esc_html_e( 'Easy File Manager needs JavaScript enabled.', 'easy-file-manager' ); ?></p></noscript>
		</div>
		<?php
	}

	/**
	 * Activity log screen.
	 */
	public static function render_log() {
		if ( ! Fivelle_FE_Plugin::user_can() ) {
			wp_die( esc_html__( 'You do not have permission to view this page.', 'easy-file-manager' ) );
		}
		$log    = Fivelle_FE_Logger::all();
		$labels = array(
			'upload'    => __( 'Upload', 'easy-file-manager' ),
			'download'  => __( 'Download', 'easy-file-manager' ),
			'edit'      => __( 'Edit', 'easy-file-manager' ),
			'delete'    => __( 'Delete', 'easy-file-manager' ),
			'rename'    => __( 'Rename', 'easy-file-manager' ),
			'mkdir'     => __( 'New folder', 'easy-file-manager' ),
			'mkfile'    => __( 'New file', 'easy-file-manager' ),
			'copy'      => __( 'Copy', 'easy-file-manager' ),
			'move'      => __( 'Move', 'easy-file-manager' ),
			'duplicate' => __( 'Duplicate', 'easy-file-manager' ),
			'chmod'     => __( 'Permissions', 'easy-file-manager' ),
			'compress'  => __( 'Compress', 'easy-file-manager' ),
			'extract'   => __( 'Extract', 'easy-file-manager' ),
		);
		?>
		<div class="wrap fvl-wrap fvl-admin-page">
			<?php self::page_header( __( 'Activity Log', 'easy-file-manager' ), __( 'Every change made through Easy File Manager, newest first.', 'easy-file-manager' ) ); ?>

			<?php // phpcs:ignore WordPress.Security.NonceVerification.Recommended ?>
			<?php if ( isset( $_GET['cleared'] ) ) : ?>
				<div class="notice notice-success is-dismissible"><p><?php esc_html_e( 'Activity log cleared.', 'easy-file-manager' ); ?></p></div>
			<?php endif; ?>

			<div class="fvl-card">
				<div class="fvl-card-head">
					<h2>
						<?php
						/* translators: %d: number of entries */
						echo esc_html( sprintf( _n( '%d entry', '%d entries', count( $log ), 'easy-file-manager' ), count( $log ) ) );
						?>
					</h2>
					<?php if ( $log ) : ?>
						<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" data-fvl-confirm="<?php echo esc_attr__( 'Clear the whole activity log?', 'easy-file-manager' ); ?>">
							<input type="hidden" name="action" value="fivelle_fe_clear_log">
							<?php wp_nonce_field( 'fivelle_fe_clear_log' ); ?>
							<button class="fvl-btn fvl-btn-ghost" type="submit"><?php esc_html_e( 'Clear log', 'easy-file-manager' ); ?></button>
						</form>
					<?php endif; ?>
				</div>
				<?php if ( ! $log ) : ?>
					<div class="fvl-empty-state">
						<p><strong><?php esc_html_e( 'No activity yet', 'easy-file-manager' ); ?></strong></p>
						<p><?php esc_html_e( 'Uploads, edits, deletions and other changes will appear here.', 'easy-file-manager' ); ?></p>
					</div>
				<?php else : ?>
					<table class="fvl-table">
						<thead>
							<tr>
								<th><?php esc_html_e( 'When', 'easy-file-manager' ); ?></th>
								<th><?php esc_html_e( 'User', 'easy-file-manager' ); ?></th>
								<th><?php esc_html_e( 'Action', 'easy-file-manager' ); ?></th>
								<th><?php esc_html_e( 'Item', 'easy-file-manager' ); ?></th>
							</tr>
						</thead>
						<tbody>
						<?php foreach ( $log as $row ) : ?>
							<?php $a = isset( $row['a'] ) ? $row['a'] : ''; ?>
							<tr>
								<td title="<?php echo esc_attr( wp_date( 'Y-m-d H:i:s', (int) $row['t'] ) ); ?>">
									<?php
									/* translators: %s: human time difference */
									echo esc_html( sprintf( __( '%s ago', 'easy-file-manager' ), human_time_diff( (int) $row['t'] ) ) );
									?>
								</td>
								<td><?php echo esc_html( $row['n'] ); ?></td>
								<td><span class="fvl-badge fvl-badge-<?php echo esc_attr( $a ); ?>"><?php echo esc_html( isset( $labels[ $a ] ) ? $labels[ $a ] : $a ); ?></span></td>
								<td><code>/<?php echo esc_html( $row['p'] ); ?></code> <span class="fvl-muted"><?php echo esc_html( $row['d'] ); ?></span></td>
							</tr>
						<?php endforeach; ?>
						</tbody>
					</table>
				<?php endif; ?>
			</div>
			<?php self::about_card( 'activity-log' ); ?>
		</div>
		<?php
	}

	/**
	 * Clear-log handler.
	 */
	public static function clear_log() {
		check_admin_referer( 'fivelle_fe_clear_log' );
		if ( ! Fivelle_FE_Plugin::user_can() ) {
			wp_die( esc_html__( 'You do not have permission to do this.', 'easy-file-manager' ) );
		}
		Fivelle_FE_Logger::clear();
		wp_safe_redirect( admin_url( 'admin.php?page=' . self::SLUG . '-log&cleared=1' ) );
		exit;
	}

	/* --------------------------------------------------------------------- */
	/* Settings                                                               */
	/* --------------------------------------------------------------------- */

	/**
	 * Register the option with the Settings API.
	 */
	public static function register_settings() {
		register_setting(
			'fivelle_fe',
			Fivelle_FE_Plugin::OPTION,
			array(
				'type'              => 'array',
				'sanitize_callback' => array( __CLASS__, 'sanitize' ),
				'default'           => Fivelle_FE_Plugin::defaults(),
			)
		);
	}

	/**
	 * Sanitize settings.
	 *
	 * @param mixed $in Submitted values.
	 * @return array
	 */
	public static function sanitize( $in ) {
		$out = Fivelle_FE_Plugin::settings();
		$in  = is_array( $in ) ? $in : array();

		if ( ! Fivelle_FE_Plugin::root_locked() && isset( $in['root'] ) ) {
			$root = trim( (string) $in['root'] );
			$real = '' === $root ? false : realpath( $root );
			if ( $real && is_dir( $real ) ) {
				$out['root'] = $real;
			} else {
				add_settings_error( Fivelle_FE_Plugin::OPTION, 'fvl-root', __( 'The root folder does not exist on the server. The previous folder was kept.', 'easy-file-manager' ) );
			}
		}

		$out['read_only']     = empty( $in['read_only'] ) ? 0 : 1;
		$out['show_hidden']   = empty( $in['show_hidden'] ) ? 0 : 1;
		$out['log_enabled']   = empty( $in['log_enabled'] ) ? 0 : 1;
		$out['editor_max_kb'] = isset( $in['editor_max_kb'] ) ? min( 20480, max( 64, absint( $in['editor_max_kb'] ) ) ) : 2048;

		$users = isset( $in['allowed_users'] ) ? sanitize_textarea_field( (string) $in['allowed_users'] ) : '';
		if ( '' !== trim( $users ) ) {
			// Never lock out the person saving the form.
			$me   = strtolower( wp_get_current_user()->user_login );
			$list = array_filter( preg_split( '/[\s,]+/', strtolower( $users ) ) );
			if ( $me && ! in_array( $me, $list, true ) ) {
				$list[] = $me;
			}
			$users = implode( ', ', array_unique( $list ) );
		}
		$out['allowed_users'] = $users;

		return $out;
	}

	/**
	 * Settings screen.
	 */
	public static function render_settings() {
		if ( ! Fivelle_FE_Plugin::user_can() ) {
			wp_die( esc_html__( 'You do not have permission to view this page.', 'easy-file-manager' ) );
		}
		$s   = Fivelle_FE_Plugin::settings();
		$opt = Fivelle_FE_Plugin::OPTION;
		$ro_forced = defined( 'DISALLOW_FILE_MODS' ) && DISALLOW_FILE_MODS;
		?>
		<div class="wrap fvl-wrap fvl-admin-page">
			<?php self::page_header( __( 'Settings', 'easy-file-manager' ), __( 'Control where the explorer can go and who can use it.', 'easy-file-manager' ) ); ?>
			<?php settings_errors( $opt ); ?>

			<form method="post" action="options.php" class="fvl-settings">
				<?php settings_fields( 'fivelle_fe' ); ?>

				<div class="fvl-card">
					<div class="fvl-card-head"><h2><?php esc_html_e( 'Access', 'easy-file-manager' ); ?></h2></div>

					<div class="fvl-field">
						<label for="fvl-root"><?php esc_html_e( 'Root folder', 'easy-file-manager' ); ?></label>
						<div>
							<input type="text" class="regular-text code" id="fvl-root" name="<?php echo esc_attr( $opt ); ?>[root]" value="<?php echo esc_attr( Fivelle_FE_Plugin::root_path() ); ?>" <?php disabled( Fivelle_FE_Plugin::root_locked() ); ?>>
							<p class="description">
								<?php if ( Fivelle_FE_Plugin::root_locked() ) : ?>
									<?php esc_html_e( 'Locked by the FIVELLE_FE_ROOT constant in wp-config.php.', 'easy-file-manager' ); ?>
								<?php else : ?>
									<?php
									/* translators: %s: WordPress install path */
									echo esc_html( sprintf( __( 'The explorer can never leave this folder. Default is your WordPress install: %s', 'easy-file-manager' ), untrailingslashit( ABSPATH ) ) );
									?>
								<?php endif; ?>
							</p>
						</div>
					</div>

					<div class="fvl-field">
						<label for="fvl-users"><?php esc_html_e( 'Allowed administrators', 'easy-file-manager' ); ?></label>
						<div>
							<textarea id="fvl-users" class="large-text" rows="2" name="<?php echo esc_attr( $opt ); ?>[allowed_users]" placeholder="admin, jane"><?php echo esc_textarea( $s['allowed_users'] ); ?></textarea>
							<p class="description"><?php esc_html_e( 'Leave empty to allow every administrator. Otherwise list usernames separated by commas. You are always kept on the list.', 'easy-file-manager' ); ?></p>
						</div>
					</div>

					<div class="fvl-field">
						<span class="fvl-label"><?php esc_html_e( 'Read-only mode', 'easy-file-manager' ); ?></span>
						<div>
							<label class="fvl-switch">
								<input type="checkbox" name="<?php echo esc_attr( $opt ); ?>[read_only]" value="1" <?php checked( $s['read_only'] || $ro_forced ); ?> <?php disabled( $ro_forced ); ?>>
								<span class="fvl-switch-ui"></span>
								<?php esc_html_e( 'Allow browsing and downloading only', 'easy-file-manager' ); ?>
							</label>
							<?php if ( $ro_forced ) : ?>
								<p class="description"><?php esc_html_e( 'Forced on because DISALLOW_FILE_MODS is set in wp-config.php.', 'easy-file-manager' ); ?></p>
							<?php endif; ?>
						</div>
					</div>
				</div>

				<div class="fvl-card">
					<div class="fvl-card-head"><h2><?php esc_html_e( 'Explorer', 'easy-file-manager' ); ?></h2></div>

					<div class="fvl-field">
						<span class="fvl-label"><?php esc_html_e( 'Hidden files', 'easy-file-manager' ); ?></span>
						<div>
							<label class="fvl-switch">
								<input type="checkbox" name="<?php echo esc_attr( $opt ); ?>[show_hidden]" value="1" <?php checked( $s['show_hidden'] ); ?>>
								<span class="fvl-switch-ui"></span>
								<?php esc_html_e( 'Show dot-files such as .htaccess by default', 'easy-file-manager' ); ?>
							</label>
						</div>
					</div>

					<div class="fvl-field">
						<label for="fvl-max"><?php esc_html_e( 'Editor size limit', 'easy-file-manager' ); ?></label>
						<div>
							<input type="number" id="fvl-max" min="64" max="20480" step="64" name="<?php echo esc_attr( $opt ); ?>[editor_max_kb]" value="<?php echo esc_attr( $s['editor_max_kb'] ); ?>"> KB
							<p class="description"><?php esc_html_e( 'Larger files can still be downloaded, just not edited in the browser.', 'easy-file-manager' ); ?></p>
						</div>
					</div>

					<div class="fvl-field">
						<span class="fvl-label"><?php esc_html_e( 'Activity log', 'easy-file-manager' ); ?></span>
						<div>
							<label class="fvl-switch">
								<input type="checkbox" name="<?php echo esc_attr( $opt ); ?>[log_enabled]" value="1" <?php checked( $s['log_enabled'] ); ?>>
								<span class="fvl-switch-ui"></span>
								<?php esc_html_e( 'Record uploads, edits, deletions and other changes', 'easy-file-manager' ); ?>
							</label>
						</div>
					</div>
				</div>

				<div class="fvl-card fvl-card-info">
					<div class="fvl-card-head"><h2><?php esc_html_e( 'Hardening tips', 'easy-file-manager' ); ?></h2></div>
					<ul>
						<li><?php echo wp_kses( __( 'Lock the root folder from code: <code>define( \'FIVELLE_FE_ROOT\', \'/path/to/folder\' );</code> in wp-config.php.', 'easy-file-manager' ), array( 'code' => array() ) ); ?></li>
						<li><?php echo wp_kses( __( '<code>define( \'DISALLOW_FILE_MODS\', true );</code> forces read-only mode.', 'easy-file-manager' ), array( 'code' => array() ) ); ?></li>
						<li><?php esc_html_e( 'Only administrators (Super Admins on multisite) can ever open the explorer.', 'easy-file-manager' ); ?></li>
					</ul>
				</div>

				<?php submit_button( __( 'Save settings', 'easy-file-manager' ), 'fvl-btn fvl-btn-primary', 'submit', false ); ?>
			</form>
			<?php self::about_card( 'settings' ); ?>
		</div>
		<?php
	}

	/**
	 * "Developed by Fivelle" card shown at the bottom of the Settings and Activity Log screens.
	 *
	 * @param string $where Screen name, used for link tracking.
	 */
	private static function about_card( $where ) {
		?>
		<div class="fvl-about">
			<span class="fvl-about-logo" aria-hidden="true">
				<svg viewBox="0 0 32 32"><defs><linearGradient id="fvlab" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6D5DFC"/><stop offset="1" stop-color="#B05CF6"/></linearGradient></defs><rect width="32" height="32" rx="9" fill="url(#fvlab)"/><path d="M13 9.5h7.5v2.4h-4.8v2.6h4.2v2.4h-4.2v5.6H13z" fill="#fff"/></svg>
			</span>
			<div class="fvl-about-txt">
				<strong><?php esc_html_e( 'Developed by Fivelle', 'easy-file-manager' ); ?></strong>
				<span><?php esc_html_e( 'We build websites, WordPress plugins and custom web solutions for businesses.', 'easy-file-manager' ); ?></span>
			</div>
			<a class="fvl-btn fvl-btn-primary" href="<?php echo esc_url( self::fivelle_url( $where . '-card' ) ); ?>" target="_blank" rel="noopener"><?php esc_html_e( 'Visit fivelle.com', 'easy-file-manager' ); ?></a>
		</div>
		<?php
	}
}
