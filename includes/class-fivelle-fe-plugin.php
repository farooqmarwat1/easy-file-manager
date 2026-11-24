<?php
/**
 * Core plugin wiring: settings, permissions and the filesystem instance.
 *
 * @package EasyFileManager
 */

defined( 'ABSPATH' ) || exit;

/**
 * Main plugin class.
 */
class Fivelle_FE_Plugin {

	const OPTION = 'fivelle_fe_settings';

	/**
	 * Cached filesystem instance.
	 *
	 * @var Fivelle_FE_Filesystem|null
	 */
	private static $fs = null;

	/**
	 * Hook everything up.
	 */
	public static function boot() {
		Fivelle_FE_Updater::init();

		if ( is_admin() ) {
			Fivelle_FE_Ajax::init();
			Fivelle_FE_Admin::init();
		}
	}

	/**
	 * Activation: seed default settings.
	 */
	public static function activate() {
		if ( false === get_option( self::OPTION ) ) {
			add_option( self::OPTION, self::defaults(), '', 'no' );
		}
	}

	/**
	 * Default settings.
	 *
	 * @return array
	 */
	public static function defaults() {
		return array(
			'root'          => untrailingslashit( ABSPATH ),
			'read_only'     => 0,
			'show_hidden'   => 1,
			'editor_max_kb' => 2048,
			'log_enabled'   => 1,
			'allowed_users' => '',
		);
	}

	/**
	 * Current settings merged with defaults.
	 *
	 * @return array
	 */
	public static function settings() {
		$saved = get_option( self::OPTION, array() );
		return wp_parse_args( is_array( $saved ) ? $saved : array(), self::defaults() );
	}

	/**
	 * A single setting.
	 *
	 * @param string $key Setting key.
	 * @return mixed
	 */
	public static function setting( $key ) {
		$s = self::settings();
		return isset( $s[ $key ] ) ? $s[ $key ] : null;
	}

	/**
	 * The folder the explorer is locked to.
	 * The FIVELLE_FE_ROOT constant (wp-config.php) overrides the setting.
	 *
	 * @return string
	 */
	public static function root_path() {
		$root = defined( 'FIVELLE_FE_ROOT' ) ? FIVELLE_FE_ROOT : self::setting( 'root' );
		if ( empty( $root ) ) {
			$root = ABSPATH;
		}
		return (string) apply_filters( 'fivelle_fe_root', $root );
	}

	/**
	 * Whether the root is locked by the constant.
	 *
	 * @return bool
	 */
	public static function root_locked() {
		return defined( 'FIVELLE_FE_ROOT' );
	}

	/**
	 * Can the current user use the explorer?
	 * Administrators only (Super Admins on multisite), optionally narrowed to a list of usernames.
	 *
	 * @return bool
	 */
	public static function user_can() {
		$can = is_multisite() ? is_super_admin() : current_user_can( 'manage_options' );

		if ( $can ) {
			$list = self::allowed_users();
			if ( ! empty( $list ) ) {
				$user = wp_get_current_user();
				$can  = in_array( strtolower( $user->user_login ), $list, true );
			}
		}

		return (bool) apply_filters( 'fivelle_fe_user_can', $can );
	}

	/**
	 * Parsed allowed usernames list.
	 *
	 * @return string[]
	 */
	public static function allowed_users() {
		$raw = (string) self::setting( 'allowed_users' );
		$out = array();
		foreach ( preg_split( '/[\s,]+/', strtolower( $raw ) ) as $u ) {
			if ( '' !== $u ) {
				$out[] = $u;
			}
		}
		return $out;
	}

	/**
	 * Read-only mode (setting, or DISALLOW_FILE_MODS in wp-config.php).
	 *
	 * @return bool
	 */
	public static function read_only() {
		$ro = (bool) self::setting( 'read_only' ) || ( defined( 'DISALLOW_FILE_MODS' ) && DISALLOW_FILE_MODS );
		return (bool) apply_filters( 'fivelle_fe_read_only', $ro );
	}

	/**
	 * Filesystem instance bound to the configured root.
	 *
	 * @return Fivelle_FE_Filesystem
	 * @throws Fivelle_FE_Exception When the root is invalid.
	 */
	public static function fs() {
		if ( null === self::$fs ) {
			self::$fs = new Fivelle_FE_Filesystem( self::root_path() );
		}
		return self::$fs;
	}
}
