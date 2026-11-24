=== Easy File Manager ===
Contributors: farooqmarwat
Tags: file manager, file explorer, files, code editor, ftp
Requires at least: 5.8
Tested up to: 7.0
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Easy, secure file manager for your whole website: browse, upload, edit, zip and manage files right inside WordPress.

== Description ==

Easy File Manager is an easy file explorer that lets administrators browse and manage every file of the website without FTP or cPanel. It is built and maintained by [Fivelle](https://fivelle.com/).

**Browse**

* Folder tree sidebar, breadcrumbs, back / forward / up
* Grid view with live image thumbnails, or a detailed list view
* 70+ colour-coded file-type icons, and special icons for WordPress folders
* Sort by name, size, date or type; show or hide dot-files
* Instant filter, plus recursive search through every subfolder
* Quick access to the site root, wp-content, plugins, themes and uploads
* Storage meter with disk usage, PHP / WordPress version and upload limit

**Manage**

* Upload by drag & drop — files *and whole folders* — with per-file progress
* New file, new folder, rename, duplicate, delete
* Copy / cut / paste, and drag items onto folders, the tree or breadcrumbs to move them
* Compress to ZIP, extract ZIP (protected against "zip slip" paths)
* Download single files, or many files and folders as one ZIP
* Change permissions (chmod) with a visual read / write / execute grid

**Edit & preview**

* Built-in code editor (WordPress CodeMirror) with syntax highlighting for PHP, JS, CSS, HTML, JSON, SQL, Markdown, YAML and more
* Ctrl+S save, unsaved-changes guard, and conflict detection if the file changed on the server
* Full-screen previews for images, video, audio and PDF, with next / previous

**Details panel**

Size, dimensions, MIME type, modified / changed dates, permissions (octal and rwx), owner and group, server path and public URL with one-click copy, and on-demand folder size.

**Comfort**

* Right-click context menus everywhere
* Keyboard shortcuts (press ? to see them all)
* Light and dark themes
* Responsive layout for tablets and phones
* Activity log of every change

== Security ==

* Only administrators can use it (Super Admins on a multisite network). You can narrow this to a list of usernames.
* Every request needs a WordPress nonce and a capability check.
* All paths are resolved on the server and locked to the root folder; `..`, symlinks that point outside and absolute paths are rejected.
* Read-only mode, also forced automatically when `DISALLOW_FILE_MODS` is set.
* Lock the root folder from code with `define( 'FIVELLE_FE_ROOT', '/path/to/folder' );` in wp-config.php.
* Inline previews are only served for media types, with `nosniff` and a sandboxed Content-Security-Policy.

== Installation ==

1. Upload the `easy-file-manager` folder to `/wp-content/plugins/`, or upload the ZIP from Plugins → Add New → Upload Plugin.
2. Activate the plugin.
3. Open **File Manager** in the admin menu.

== Frequently Asked Questions ==

= Which folder does it open? =

Your WordPress install folder by default. Change it under File Manager → Settings, for example to the parent folder to reach files above WordPress.

= Why can't I upload big files? =

Uploads are limited by your server's `upload_max_filesize` and `post_max_size`. The current limit is shown in the Upload menu and the storage card.

= Are deleted files recoverable? =

No. Deletion is permanent, so the file manager always asks you to confirm first.

== Changelog ==

= 1.0.0 =
* First release.

== About Fivelle ==

Easy File Manager is developed by [Fivelle](https://fivelle.com/). We build websites, WordPress plugins and custom web solutions for businesses. Need help or a custom feature? Visit [fivelle.com](https://fivelle.com/).
