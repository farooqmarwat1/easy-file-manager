<?php
/**
 * Activity log stored in a non-autoloaded option.
 *
 * @package EasyFileManager
 */

defined( 'ABSPATH' ) || exit;

/**
 * Logger.
 */
class Fivelle_FE_Logger {

	const OPTION = 'fivelle_fe_log';
	const MAX    = 500;

	/**
	 * Record an action.
	 *
	 * @param string $action Action slug.
	 * @param string $target Relative path(s) affected.
	 * @param string $detail Optional extra detail.
	 */
	public static function add( $action, $target, $detail = '' ) {
		if ( ! Fivelle_FE_Plugin::setting( 'log_enabled' ) ) {
			return;
		}
		$user = wp_get_current_user();
		$log  = self::all();
		array_unshift(
			$log,
			array(
				't' => time(),
				'u' => (int) $user->ID,
				'n' => (string) $user->user_login,
				'a' => (string) $action,
				'p' => (string) $target,
				'd' => (string) $detail,
			)
		);
		if ( count( $log ) > self::MAX ) {
			$log = array_slice( $log, 0, self::MAX );
		}
		update_option( self::OPTION, $log, false );
	}

	/**
	 * All entries, newest first.
	 *
	 * @return array
	 */
	public static function all() {
		$log = get_option( self::OPTION, array() );
		return is_array( $log ) ? $log : array();
	}

	/**
	 * Remove every entry.
	 */
	public static function clear() {
		update_option( self::OPTION, array(), false );
	}
}
