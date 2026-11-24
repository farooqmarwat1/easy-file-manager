<?php
/**
 * Plugin Name:       Easy File Manager
 * Plugin URI:        https://fivelle.com/
 * Description:       Easy, secure file manager for your whole website. Browse, upload, edit, preview, zip, extract and manage every file from the WordPress dashboard. Developed by Fivelle.
 * Version:           1.0.0
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            Fivelle
 * Author URI:        https://fivelle.com/
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       easy-file-manager
 * Domain Path:       /languages
 * Update URI:        https://github.com/farooqmarwat1/easy-file-manager
 *
 * @package EasyFileManager
 */

defined( 'ABSPATH' ) || exit;

define( 'FIVELLE_FE_VERSION', '1.0.0' );
define( 'FIVELLE_FE_FILE', __FILE__ );
define( 'FIVELLE_FE_DIR', plugin_dir_path( __FILE__ ) );
define( 'FIVELLE_FE_URL', plugin_dir_url( __FILE__ ) );
define( 'FIVELLE_FE_SITE', 'https://fivelle.com/' );

require_once FIVELLE_FE_DIR . 'includes/class-fivelle-fe-filesystem.php';
require_once FIVELLE_FE_DIR . 'includes/class-fivelle-fe-logger.php';
require_once FIVELLE_FE_DIR . 'includes/class-fivelle-fe-plugin.php';
require_once FIVELLE_FE_DIR . 'includes/class-fivelle-fe-ajax.php';
require_once FIVELLE_FE_DIR . 'includes/class-fivelle-fe-admin.php';
require_once FIVELLE_FE_DIR . 'includes/class-fivelle-fe-updater.php';

register_activation_hook( __FILE__, array( 'Fivelle_FE_Plugin', 'activate' ) );

add_action( 'plugins_loaded', array( 'Fivelle_FE_Plugin', 'boot' ) );
