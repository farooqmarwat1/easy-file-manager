<?php
/**
 * One-click updates from GitHub releases.
 *
 * The plugin header sets "Update URI" to the GitHub repository, so WordPress never
 * confuses this plugin with a WordPress.org plugin of the same name, and asks the
 * `update_plugins_github.com` filter below for update information instead.
 *
 * @package EasyFileManager
 */

defined( 'ABSPATH' ) || exit;

/**
 * GitHub release updater.
 */
class Fivelle_FE_Updater {

	const REPO      = 'farooqmarwat1/easy-file-manager';
	const ASSET     = 'easy-file-manager.zip';
	const SLUG      = 'easy-file-manager';
	const TRANSIENT = 'fivelle_fe_release';

	/**
	 * Register hooks.
	 */
	public static function init() {
		add_filter( 'update_plugins_github.com', array( __CLASS__, 'check' ), 10, 3 );
		add_filter( 'plugins_api', array( __CLASS__, 'details' ), 20, 3 );
		add_action( 'upgrader_process_complete', array( __CLASS__, 'purge' ), 10, 0 );
	}

	/**
	 * Repository URL.
	 *
	 * @return string
	 */
	public static function repo_url() {
		return 'https://github.com/' . self::REPO;
	}

	/**
	 * Latest published release, cached for 12 hours (1 hour after a failed lookup).
	 *
	 * @return array Empty when unavailable.
	 */
	private static function latest() {
		$cached = get_site_transient( self::TRANSIENT );
		if ( is_array( $cached ) ) {
			return $cached;
		}

		$data = array();
		$res  = wp_remote_get(
			'https://api.github.com/repos/' . self::REPO . '/releases/latest',
			array(
				'timeout' => 10,
				'headers' => array(
					'Accept'     => 'application/vnd.github+json',
					'User-Agent' => 'Easy-File-Manager/' . FIVELLE_FE_VERSION,
				),
			)
		);

		if ( ! is_wp_error( $res ) && 200 === (int) wp_remote_retrieve_response_code( $res ) ) {
			$json = json_decode( wp_remote_retrieve_body( $res ), true );
			if ( is_array( $json ) && ! empty( $json['tag_name'] ) && ! empty( $json['assets'] ) ) {
				foreach ( (array) $json['assets'] as $asset ) {
					if ( isset( $asset['name'], $asset['browser_download_url'] ) && self::ASSET === $asset['name'] ) {
						$data = array(
							'version' => ltrim( (string) $json['tag_name'], 'vV' ),
							'package' => esc_url_raw( $asset['browser_download_url'] ),
							'url'     => esc_url_raw( isset( $json['html_url'] ) ? $json['html_url'] : self::repo_url() ),
							'notes'   => isset( $json['body'] ) ? (string) $json['body'] : '',
							'date'    => isset( $json['published_at'] ) ? (string) $json['published_at'] : '',
						);
						break;
					}
				}
			}
		}

		set_site_transient( self::TRANSIENT, $data, $data ? 12 * HOUR_IN_SECONDS : HOUR_IN_SECONDS );
		return $data;
	}

	/**
	 * Supply update information for this plugin. WordPress compares the versions itself.
	 *
	 * @param array|false $update      Update data.
	 * @param array       $plugin_data Plugin headers.
	 * @param string      $plugin_file Plugin basename.
	 * @return array|false
	 */
	public static function check( $update, $plugin_data, $plugin_file ) {
		if ( plugin_basename( FIVELLE_FE_FILE ) !== $plugin_file ) {
			return $update;
		}
		$release = self::latest();
		if ( empty( $release ) ) {
			return $update;
		}
		return array(
			'slug'         => self::SLUG,
			'version'      => $release['version'],
			'url'          => $release['url'],
			'package'      => $release['package'],
			'requires_php' => '7.4',
			'icons'        => array(
				'1x' => 'https://raw.githubusercontent.com/' . self::REPO . '/main/.wordpress-org/icon-128x128.png',
				'2x' => 'https://raw.githubusercontent.com/' . self::REPO . '/main/.wordpress-org/icon-256x256.png',
			),
		);
	}

	/**
	 * "View details" popup on the Plugins and Updates screens.
	 *
	 * @param false|object|array $result Result.
	 * @param string             $action API action.
	 * @param object             $args   Arguments.
	 * @return false|object|array
	 */
	public static function details( $result, $action, $args ) {
		if ( 'plugin_information' !== $action || empty( $args->slug ) || self::SLUG !== $args->slug ) {
			return $result;
		}
		$release = self::latest();
		$raw     = 'https://raw.githubusercontent.com/' . self::REPO . '/main/.wordpress-org/';

		return (object) array(
			'name'          => 'Easy File Manager',
			'slug'          => self::SLUG,
			'version'       => $release ? $release['version'] : FIVELLE_FE_VERSION,
			'author'        => '<a href="' . esc_url( FIVELLE_FE_SITE ) . '">Fivelle</a>',
			'homepage'      => self::repo_url(),
			'requires'      => '5.8',
			'requires_php'  => '7.4',
			'last_updated'  => $release ? $release['date'] : '',
			'download_link' => $release ? $release['package'] : '',
			'banners'       => array(
				'low'  => $raw . 'banner-772x250.png',
				'high' => $raw . 'banner-1544x500.png',
			),
			'sections'      => array(
				'description' => '<p>' . esc_html__( 'Easy, secure file manager for your whole website. Browse, upload, edit, preview, zip, extract and manage every file from the WordPress dashboard.', 'easy-file-manager' ) . '</p><p>' . sprintf(
					/* translators: %s: link to the Fivelle website */
					esc_html__( 'Developed by %s.', 'easy-file-manager' ),
					'<a href="' . esc_url( FIVELLE_FE_SITE ) . '">Fivelle</a>'
				) . '</p>',
				'changelog'   => $release && '' !== $release['notes'] ? wpautop( esc_html( $release['notes'] ) ) : '<p><a href="' . esc_url( self::repo_url() . '/releases' ) . '">' . esc_html__( 'See all releases on GitHub', 'easy-file-manager' ) . '</a></p>',
			),
		);
	}

	/**
	 * Forget the cached release after any update, so the next check is fresh.
	 */
	public static function purge() {
		delete_site_transient( self::TRANSIENT );
	}
}
