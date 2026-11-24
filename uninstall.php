<?php
/**
 * Removes plugin options when the plugin is deleted. Files on disk are never touched.
 *
 * @package EasyFileManager
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

delete_option( 'fivelle_fe_settings' );
delete_option( 'fivelle_fe_log' );
delete_site_transient( 'fivelle_fe_release' );
