/*!
 * Easy File Manager
 * Vanilla JS app for the WordPress admin. No build step required.
 */
(function () {
	'use strict';

	const C = window.FivelleFE;
	const root = document.getElementById('fivelle-app');
	if (!C || !root) {
		return;
	}
	const RO = !!C.readOnly;

	/* ================================================================== */
	/* Utilities                                                           */
	/* ================================================================== */

	const $ = (s, r) => (r || root).querySelector(s);
	const $$ = (s, r) => Array.from((r || root).querySelectorAll(s));
	const esc = (s) =>
		String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
	const reveal = (el) => {
		void el.offsetWidth; // force a reflow so the CSS transition runs even in background tabs
		el.classList.add('is-in');
	};
	const sel = (p) =>'[data-path="' + CSS.escape(p) + '"]';
	const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
	const join = (dir, name) => (dir ? dir + '/' + name : name);
	const parentOf = (p) => (p.indexOf('/') > -1 ? p.slice(0, p.lastIndexOf('/')) : '');
	const baseOf = (p) => (p.indexOf('/') > -1 ? p.slice(p.lastIndexOf('/') + 1) : p);

	const store = {
		get(k, d) {
			try {
				const v = localStorage.getItem('fvl-' + k);
				return v === null ? d : JSON.parse(v);
			} catch (e) {
				return d;
			}
		},
		set(k, v) {
			try {
				localStorage.setItem('fvl-' + k, JSON.stringify(v));
			} catch (e) {
				/* storage unavailable */
			}
		},
	};

	function fmtSize(b) {
		if (b == null || isNaN(b)) {
			return '—';
		}
		if (b < 1024) {
			return b + ' B';
		}
		const u = ['KB', 'MB', 'GB', 'TB', 'PB'];
		let i = -1;
		do {
			b /= 1024;
			i++;
		} while (b >= 1024 && i < u.length - 1);
		return (b >= 100 ? Math.round(b) : b.toFixed(1)) + ' ' + u[i];
	}

	function fmtDate(ts) {
		if (!ts) {
			return '—';
		}
		return new Date(ts * 1000).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
	}

	function relTime(ts) {
		if (!ts) {
			return '—';
		}
		const s = Math.round(Date.now() / 1000 - ts);
		if (s < 45) {
			return 'Just now';
		}
		const steps = [
			[3600, 60, 'min'],
			[86400, 3600, 'hr'],
			[86400 * 7, 86400, 'day'],
		];
		for (const [lim, div, unit] of steps) {
			if (s < lim) {
				const n = Math.round(s / div);
				return n + ' ' + unit + (n > 1 && unit !== 'min' && unit !== 'hr' ? 's' : '') + ' ago';
			}
		}
		return new Date(ts * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
	}

	function rwx(perms) {
		const o = String(perms || '').slice(-3);
		if (!/^[0-7]{3}$/.test(o)) {
			return '';
		}
		return o
			.split('')
			.map((d) => {
				const n = parseInt(d, 8);
				return (n & 4 ? 'r' : '-') + (n & 2 ? 'w' : '-') + (n & 1 ? 'x' : '-');
			})
			.join('');
	}

	function debounce(fn, ms) {
		let t;
		return function () {
			const args = arguments;
			clearTimeout(t);
			t = setTimeout(() => fn.apply(null, args), ms);
		};
	}

	async function copyText(text, label) {
		try {
			await navigator.clipboard.writeText(text);
		} catch (e) {
			const ta = document.createElement('textarea');
			ta.value = text;
			document.body.appendChild(ta);
			ta.select();
			document.execCommand('copy');
			ta.remove();
		}
		toast((label || 'Copied') + ' to clipboard', 'success');
	}

	/* ================================================================== */
	/* Icons                                                               */
	/* ================================================================== */

	const P = {
		arrowLeft: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
		arrowRight: '<path d="M5 12h14M12 5l7 7-7 7"/>',
		arrowUp: '<path d="M12 19V5M5 12l7-7 7 7"/>',
		refresh: '<path d="M21 12a9 9 0 0 1-15.5 6.3L3 16M3 12a9 9 0 0 1 15.5-6.3L21 8M21 3v5h-5M3 21v-5h5"/>',
		home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
		grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
		list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
		search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
		upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
		download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
		folderPlus: '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9L9.6 3.9A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2zM12 10v6M9 13h6"/>',
		folderUpload: '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9L9.6 3.9A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2z"/><path d="M12 17v-6M9 14l3-3 3 3"/>',
		folderOpen: '<path d="m6 14 1.5-2.9A2 2 0 0 1 9.2 10H20a2 2 0 0 1 1.9 2.5l-1.5 6A2 2 0 0 1 18.5 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.7.9l.8 1.2a2 2 0 0 0 1.7.9H18a2 2 0 0 1 2 2v2"/>',
		filePlus: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 18v-6M9 15h6"/>',
		file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
		plus: '<path d="M12 5v14M5 12h14"/>',
		trash: '<path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/>',
		pencil: '<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
		copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
		scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/>',
		clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
		archive: '<rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/>',
		unarchive: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
		info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
		lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
		eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
		eyeOff: '<path d="M9.9 4.2A10 10 0 0 1 12 4c6.5 0 10 8 10 8a17 17 0 0 1-2.2 3.2M6.6 6.6A17 17 0 0 0 2 12s3.5 8 10 8a9.7 9.7 0 0 0 5.4-1.6M2 2l20 20M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
		x: '<path d="M18 6 6 18M6 6l12 12"/>',
		check: '<path d="M20 6 9 17l-5-5"/>',
		sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
		moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
		settings: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
		activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
		chevronRight: '<path d="m9 18 6-6-6-6"/>',
		chevronLeft: '<path d="m15 18-6-6 6-6"/>',
		chevronDown: '<path d="m6 9 6 6 6-6"/>',
		hardDrive: '<path d="M22 12H2M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1zM6 16h.01M10 16h.01"/>',
		save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
		link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
		external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
		sort: '<path d="m3 16 4 4 4-4M7 20V4M21 8l-4-4-4 4M17 4v16"/>',
		sigma: '<path d="M18 7V4H6l6 8-6 8h12v-3"/>',
		code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
		menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
		globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
		panel: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/>',
		keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
		selectAll: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="m9 12 2 2 4-4"/>',
		wrap: '<path d="M3 6h18M3 12h15a3 3 0 1 1 0 6h-4M16 16l-2 2 2 2M3 18h7"/>',
		shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
		play: '<path d="M7 4.5v15l12.5-7.5z"/>',
		/* glyphs used inside file & folder icons */
		gCode: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>',
		gImage: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
		gVideo: '<path d="M8 5.5v13l11-6.5z" fill="currentColor"/>',
		gAudio: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
		gArchive: '<path d="M12 2.5v1.5M12 6v1.5M12 9.5V11"/><rect x="8.5" y="13" width="7" height="8" rx="1.8"/><path d="M12 16v2"/>',
		gText: '<path d="M5 7h14M5 11h14M5 15h9"/>',
		gData: '<ellipse cx="12" cy="5.5" rx="7.5" ry="3"/><path d="M4.5 5.5v13c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-13M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3"/>',
		gSheet: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M4 15h16M10 4v16"/>',
		gSlides: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 16v4M8 20h8"/>',
		gConfig: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M2.5 12h3M18.5 12h3M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
		gFont: '<path d="M5 20 11 4h2l6 16M7.5 14h9"/>',
		gBinary: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 9h6v6H9z"/>',
		gLock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
		gPlug: '<path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0zM12 18v4"/>',
		gPalette: '<path d="M12 3a9 9 0 1 0 0 18c1 0 1.5-.7 1.5-1.5 0-.4-.2-.8-.4-1.1-.3-.3-.4-.6-.4-1.1 0-.8.7-1.5 1.5-1.5H16a5 5 0 0 0 5-5c0-4.4-4-7.8-9-7.8z"/><circle cx="7.5" cy="11" r=".6"/><circle cx="10.5" cy="7.5" r=".6"/><circle cx="15" cy="7.5" r=".6"/>',
		gCloud: '<path d="M12 13v8M8.5 16.5 12 13l3.5 3.5"/><path d="M20 16.6A5 5 0 0 0 18 7h-1.3A8 8 0 1 0 4 15.3"/>',
		gBox: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
		gShield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
		gGlobe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
		gGit: '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="8" r="2.5"/><path d="M6 8.5v7M18 10.5c0 4-6 3-10.5 6"/>',
		gBolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
	};

	function ui(name, cls) {
		return '<svg class="fvl-i' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[name] || '') + '</svg>';
	}

	/* Extension registry: ext → [badge label, colour, glyph, kind] */
	const T = {};
	function def(exts, color, glyph, kind, label) {
		exts.split(' ').forEach((e) => {
			T[e] = [label || e.toUpperCase(), color, glyph, kind];
		});
	}
	def('php phtml inc', '#777BB4', 'gCode', 'PHP script', 'PHP');
	def('js mjs cjs', '#D4A20B', 'gCode', 'JavaScript', 'JS');
	def('ts', '#3178C6', 'gCode', 'TypeScript');
	def('tsx jsx', '#0EA5E9', 'gCode', 'React component');
	def('json', '#F59E0B', 'gCode', 'JSON data', 'JSON');
	def('map', '#94A3B8', 'gCode', 'Source map');
	def('css', '#2965F1', 'gCode', 'Stylesheet');
	def('scss sass', '#CD6799', 'gCode', 'Sass stylesheet');
	def('less', '#1D365D', 'gCode', 'Less stylesheet');
	def('html htm', '#E34F26', 'gCode', 'HTML document', 'HTML');
	def('twig tpl', '#8BC34A', 'gCode', 'Template');
	def('vue', '#41B883', 'gCode', 'Vue component');
	def('xml', '#F97316', 'gCode', 'XML document');
	def('svg', '#F59E0B', 'gImage', 'SVG image');
	def('md markdown', '#0EA5E9', 'gText', 'Markdown', 'MD');
	def('txt', '#64748B', 'gText', 'Text file');
	def('log', '#94A3B8', 'gText', 'Log file');
	def('pot po mo', '#0EA5E9', 'gGlobe', 'Translation');
	def('sql', '#0891B2', 'gData', 'SQL script');
	def('db sqlite', '#0891B2', 'gData', 'Database', 'DB');
	def('py', '#3776AB', 'gCode', 'Python script');
	def('rb', '#CC342D', 'gCode', 'Ruby script');
	def('java', '#E76F00', 'gCode', 'Java source');
	def('go', '#00ADD8', 'gCode', 'Go source');
	def('c h cpp', '#5C6BC0', 'gCode', 'C source');
	def('cs', '#68217A', 'gCode', 'C# source');
	def('sh bash zsh bat ps1', '#4EAA25', 'gCode', 'Shell script');
	def('yml yaml', '#CB171E', 'gConfig', 'YAML config', 'YML');
	def('ini conf cfg env toml', '#6B7280', 'gConfig', 'Configuration');
	def('htaccess htpasswd', '#6B7280', 'gConfig', 'Server config', 'HTA');
	def('lock', '#9CA3AF', 'gLock', 'Lock file');
	def('jpg jpeg png gif webp bmp ico avif tif tiff heic', '#10B981', 'gImage', 'Image');
	def('psd', '#31A8FF', 'gImage', 'Photoshop file');
	def('ai eps', '#FF9A00', 'gImage', 'Illustrator file');
	def('mp4 mov webm avi mkv m4v ogv wmv', '#EF4444', 'gVideo', 'Video');
	def('mp3 wav ogg oga m4a flac aac', '#EC4899', 'gAudio', 'Audio');
	def('zip rar 7z tar gz tgz bz2 xz', '#8B5CF6', 'gArchive', 'Archive');
	def('pdf', '#E5252A', 'gText', 'PDF document', 'PDF');
	def('doc docx odt rtf', '#2B579A', 'gText', 'Word document', 'DOC');
	def('xls xlsx ods', '#217346', 'gSheet', 'Spreadsheet', 'XLS');
	def('csv', '#217346', 'gSheet', 'CSV data');
	def('ppt pptx odp key', '#D24726', 'gSlides', 'Presentation', 'PPT');
	def('ttf otf woff woff2 eot', '#475569', 'gFont', 'Font');
	def('exe dll so bin dmg iso msi apk', '#374151', 'gBinary', 'Binary');

	const EDITABLE = new Set(
		('php phtml inc js mjs cjs ts tsx jsx json map css scss sass less html htm twig tpl vue xml svg md markdown txt log pot po sql py rb java go c h cpp cs sh bash zsh bat ps1 yml yaml ini conf cfg env toml htaccess htpasswd lock csv gitignore gitattributes editorconfig babelrc eslintrc prettierrc npmrc nvmrc dist example sample').split(' ')
	);
	const IMG = new Set('jpg jpeg png gif webp bmp ico avif svg'.split(' '));
	const VID = new Set('mp4 webm ogv m4v mov'.split(' '));
	const AUD = new Set('mp3 wav ogg oga m4a flac'.split(' '));

	const isImage = (it) => !it.dir && IMG.has(it.ext);
	const isPreviewable = (it) => !it.dir && (IMG.has(it.ext) || VID.has(it.ext) || AUD.has(it.ext) || it.ext === 'pdf');
	const isEditable = (it) => !it.dir && (EDITABLE.has(it.ext) || it.ext === '');
	const isZip = (it) => !it.dir && it.ext === 'zip';

	function typeName(it) {
		if (it.dir) {
			return 'Folder';
		}
		const t = T[it.ext];
		if (t) {
			return t[3];
		}
		return it.ext ? it.ext.toUpperCase() + ' file' : 'File';
	}

	function fileIcon(it) {
		const t = T[it.ext] || ['', '#94A3B8', 'gText'];
		const label = (t[0] || (it.ext || '').toUpperCase()).slice(0, 4);
		const w = label ? Math.max(18, label.length * 5.4 + 8) : 0;
		return (
			'<svg class="fvl-fi" viewBox="0 0 48 48" aria-hidden="true">' +
			'<path class="pg" d="M13 4h15.5L39 14.5V41a3 3 0 0 1-3 3H13a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z"/>' +
			'<path d="M28.5 4 39 14.5h-7.5a3 3 0 0 1-3-3z" fill="' + t[1] + '" opacity=".5"/>' +
			'<g transform="translate(17.3 ' + (label ? 12.5 : 18) + ') scale(.6)" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" style="color:' + t[1] + '">' + P[t[2]] + '</g>' +
			(label
				? '<rect x="5" y="29" width="' + w + '" height="11" rx="3" fill="' + t[1] + '"/><text x="' + (5 + w / 2) + '" y="37.2" text-anchor="middle" class="lb">' + esc(label) + '</text>'
				: '') +
			'</svg>'
		);
	}

	const FOLDERS = {
		'wp-content': ['blue', 'gBox'],
		'wp-admin': ['blue', 'gShield'],
		'wp-includes': ['blue', 'gConfig'],
		plugins: ['blue', 'gPlug'],
		'mu-plugins': ['blue', 'gPlug'],
		themes: ['blue', 'gPalette'],
		uploads: ['blue', 'gCloud'],
		languages: ['blue', 'gGlobe'],
		'.git': ['slate', 'gGit'],
		'.github': ['slate', 'gGit'],
		node_modules: ['green', 'gBox'],
		vendor: ['green', 'gBox'],
		cache: ['violet', 'gBolt'],
		images: ['amber', 'gImage'],
		img: ['amber', 'gImage'],
		assets: ['amber', 'gImage'],
		backups: ['violet', 'gArchive'],
		backup: ['violet', 'gArchive'],
		logs: ['slate', 'gText'],
	};

	function folderIcon(it) {
		const sp = FOLDERS[String(it.name || '').toLowerCase()];
		const v = sp ? sp[0] : it.hidden ? 'slate' : 'amber';
		return (
			'<svg class="fvl-fo" viewBox="0 0 48 48" aria-hidden="true">' +
			'<path d="M5 13a4 4 0 0 1 4-4h9.3a4 4 0 0 1 2.9 1.2L24 13h15a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z" fill="url(#fvl-' + v + '-b)"/>' +
			'<path d="M5 19a3 3 0 0 1 3-3h32a3 3 0 0 1 3 3v18a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z" fill="url(#fvl-' + v + '-f)"/>' +
			'<path d="M8 17.2h32" stroke="#fff" stroke-opacity=".35" stroke-width="1.2" stroke-linecap="round"/>' +
			(sp ? '<g transform="translate(17.4 21.6) scale(.55)" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity=".95">' + P[sp[1]] + '</g>' : '') +
			'</svg>'
		);
	}

	const icon = (it) => (it.dir ? folderIcon(it) : fileIcon(it));

	function grad(id, a, b) {
		return '<linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + a + '"/><stop offset="1" stop-color="' + b + '"/></linearGradient>';
	}
	const DEFS =
		'<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>' +
		grad('fvl-amber-b', '#F0AE2E', '#DD9214') + grad('fvl-amber-f', '#FFDA72', '#FDBA3A') +
		grad('fvl-blue-b', '#4461E6', '#2B44C0') + grad('fvl-blue-f', '#8AA2FF', '#4F6FF5') +
		grad('fvl-slate-b', '#9AA3B5', '#7A8397') + grad('fvl-slate-f', '#D0D6E0', '#A9B2C1') +
		grad('fvl-green-b', '#2EA36F', '#1F8656') + grad('fvl-green-f', '#79DDA9', '#35B67B') +
		grad('fvl-violet-b', '#8B5CF6', '#6D3FE0') + grad('fvl-violet-f', '#C4A8FF', '#9A6BFA') +
		'<linearGradient id="fvl-brand" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6D5DFC"/><stop offset="1" stop-color="#B05CF6"/></linearGradient>' +
		'</defs></svg>';

	const LOGO =
		'<svg class="fvl-logo-svg" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="url(#fvl-brand)"/>' +
		'<path d="M7 11.5A2.5 2.5 0 0 1 9.5 9h4l2 2h7a2.5 2.5 0 0 1 2.5 2.5V21a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 7 21z" fill="#fff" opacity=".28"/>' +
		'<path d="M13 13.5h6.5v2h-4.2v1.6h3.6v2h-3.6v3.4H13z" fill="#fff"/></svg>';

	/* ================================================================== */
	/* Server                                                              */
	/* ================================================================== */

	async function api(op, data) {
		const fd = new FormData();
		fd.append('action', 'fivelle_fe');
		fd.append('nonce', C.nonce);
		fd.append('op', op);
		Object.entries(data || {}).forEach(([k, v]) => {
			if (Array.isArray(v)) {
				v = JSON.stringify(v);
			} else if (typeof v === 'boolean') {
				v = v ? '1' : '0';
			}
			fd.append(k, v == null ? '' : v);
		});
		let res;
		let json;
		try {
			res = await fetch(C.ajax, { method: 'POST', body: fd, credentials: 'same-origin' });
		} catch (e) {
			throw new Error('Network error — check your connection and try again.');
		}
		try {
			json = await res.json();
		} catch (e) {
			throw new Error(res.status === 403 || res.status === 400 ? 'Your session has expired. Please reload the page.' : 'The server returned an unexpected response (HTTP ' + res.status + ').');
		}
		if (!json || !json.success) {
			const err = new Error((json && json.data && json.data.message) || 'The request failed.');
			err.code = json && json.data && json.data.code;
			throw err;
		}
		return json.data;
	}

	const rawUrl = (path, dl) =>
		C.ajax + '?action=fivelle_fe_raw&nonce=' + encodeURIComponent(C.nonce) + '&path=' + encodeURIComponent(path) + (dl ? '&dl=1' : '');

	/* ================================================================== */
	/* State                                                               */
	/* ================================================================== */

	const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
	const S = {
		path: null,
		items: [],
		list: [],
		sel: new Set(),
		anchor: null,
		focus: -1,
		back: [],
		fwd: [],
		view: store.get('view', 'grid'),
		sort: store.get('sort', { k: 'name', d: 1 }),
		hidden: store.get('hidden', !!C.showHidden),
		details: store.get('details', true),
		theme: store.get('theme', prefersDark ? 'dark' : 'light'),
		clip: null,
		filter: '',
		search: null,
		writable: true,
		truncated: false,
		loading: false,
		drag: null,
	};
	const layers = [];
	const infoCache = new Map();

	/* ================================================================== */
	/* Layout                                                              */
	/* ================================================================== */

	function shell() {
		root.dataset.theme = S.theme;
		root.innerHTML =
			DEFS +
			'<div class="fvl-shell' + (S.details ? '' : ' no-details') + '">' +
			'<header class="fvl-top">' +
			'<button class="fvl-ib fvl-only-m" data-a="side" title="Folders">' + ui('menu') + '</button>' +
			'<div class="fvl-brand">' + LOGO + '<div class="fvl-brand-txt"><b>Easy File Manager</b><span>by Fivelle</span></div></div>' +
			'<div class="fvl-domain" title="' + esc(C.rootPath) + '"><span class="fvl-dot"></span>' + esc(C.site || C.rootName) + '</div>' +
			'<label class="fvl-search">' + ui('search') + '<input type="search" id="fvl-q" autocomplete="off" spellcheck="false" placeholder="Filter this folder — press Enter to search all subfolders"><kbd>/</kbd></label>' +
			'<div class="fvl-top-actions">' +
			(RO ? '<span class="fvl-pill fvl-pill-warn" title="Changes are disabled">' + ui('lock') + 'Read-only</span>' : '') +
			'<button class="fvl-ib" data-a="shortcuts" title="Keyboard shortcuts (?)">' + ui('keyboard') + '</button>' +
			'<button class="fvl-ib" data-a="theme" title="Switch light / dark">' + ui(S.theme === 'dark' ? 'sun' : 'moon') + '</button>' +
			'<a class="fvl-ib" href="' + esc(C.logUrl) + '" title="Activity log">' + ui('activity') + '</a>' +
			'<a class="fvl-ib" href="' + esc(C.settingsUrl) + '" title="Settings">' + ui('settings') + '</a>' +
			'</div></header>' +
			'<div class="fvl-body">' +
			'<aside class="fvl-side">' +
			'<div class="fvl-side-sec"><div class="fvl-side-title">Quick access</div><nav class="fvl-quick"></nav></div>' +
			'<div class="fvl-side-sec fvl-grow"><div class="fvl-side-title">Folders</div><div class="fvl-tree" role="tree"></div></div>' +
			'<div class="fvl-storage"></div>' +
			'<a class="fvl-credit" href="' + esc(C.brandUrl || 'https://fivelle.com/') + '" target="_blank" rel="noopener" title="Visit fivelle.com">' + LOGO + '<span>Developed by <b>Fivelle</b></span>' + ui('external') + '</a>' +
			'</aside>' +
			'<main class="fvl-main">' +
			'<div class="fvl-progress"></div>' +
			'<div class="fvl-toolbar">' +
			'<div class="fvl-nav">' +
			'<button class="fvl-ib" data-a="back" title="Back (Alt+←)">' + ui('arrowLeft') + '</button>' +
			'<button class="fvl-ib" data-a="forward" title="Forward (Alt+→)">' + ui('arrowRight') + '</button>' +
			'<button class="fvl-ib" data-a="up" title="Up one level (Backspace)">' + ui('arrowUp') + '</button>' +
			'<button class="fvl-ib" data-a="refresh" title="Refresh (R)">' + ui('refresh') + '</button>' +
			'</div>' +
			'<nav class="fvl-crumbs" aria-label="Path"></nav>' +
			'<div class="fvl-tools">' +
			(RO
				? ''
				: '<button class="fvl-btn fvl-paste" data-a="paste" hidden>' + ui('clipboard') + '<span>Paste</span></button>' +
				  '<button class="fvl-btn fvl-btn-primary" data-a="new-menu">' + ui('plus') + '<span>New</span>' + ui('chevronDown', 'fvl-caret') + '</button>' +
				  '<button class="fvl-btn" data-a="upload-menu">' + ui('upload') + '<span>Upload</span></button>') +
			'<div class="fvl-seg" role="group">' +
			'<button data-a="view" data-v="grid" title="Grid view (V)">' + ui('grid') + '</button>' +
			'<button data-a="view" data-v="list" title="List view (V)">' + ui('list') + '</button>' +
			'</div>' +
			'<button class="fvl-ib" data-a="sort-menu" title="Sort">' + ui('sort') + '</button>' +
			'<button class="fvl-ib" data-a="hidden" title="Show hidden files (H)">' + ui('eye') + '</button>' +
			'<button class="fvl-ib fvl-hide-m" data-a="details" title="Details panel (I)">' + ui('panel') + '</button>' +
			'</div></div>' +
			'<div class="fvl-banner" hidden></div>' +
			'<div class="fvl-selbar" hidden></div>' +
			'<div class="fvl-content" tabindex="-1">' +
			'<div class="fvl-list"></div>' +
			'<div class="fvl-drop"><div class="fvl-drop-card">' + ui('upload') + '<b>Drop to upload</b><span class="fvl-drop-to"></span></div></div>' +
			'</div>' +
			'<footer class="fvl-status"></footer>' +
			'</main>' +
			'<aside class="fvl-details"></aside>' +
			'</div>' +
			'<input type="file" id="fvl-files" multiple hidden>' +
			'<input type="file" id="fvl-folder" multiple webkitdirectory hidden>' +
			'<div class="fvl-uploads" hidden></div>' +
			'<div class="fvl-toasts" aria-live="polite"></div>' +
			'<iframe name="fvl-dl" class="fvl-dl-frame" title="download" hidden></iframe>' +
			'</div>';
	}

	const shellEl = () => $('.fvl-shell');

	function fit() {
		const top = root.getBoundingClientRect().top + window.scrollY;
		root.style.height = Math.max(520, window.innerHeight - top - 16) + 'px';
	}

	function renderQuick() {
		$('.fvl-quick').innerHTML = (C.quick || [])
			.map((q) => {
				const ic = { home: 'home', box: 'gBox', plug: 'gPlug', palette: 'gPalette', image: 'gImage' }[q.icon] || 'folderOpen';
				return '<button class="fvl-q" data-a="go" data-path="' + esc(q.path) + '">' + ui(ic) + '<span>' + esc(q.label) + '</span></button>';
			})
			.join('');
	}

	function renderCrumbs() {
		const parts = S.path ? S.path.split('/') : [];
		let acc = '';
		let html = '<button class="fvl-crumb fvl-crumb-root" data-a="go" data-path="" data-drop="1" title="' + esc(C.rootPath) + '">' + ui('home') + '<span>' + esc(C.site || C.rootName) + '</span></button>';
		parts.forEach((p, i) => {
			acc = join(acc, p);
			html += ui('chevronRight', 'fvl-crumb-sep') + '<button class="fvl-crumb' + (i === parts.length - 1 ? ' is-current' : '') + '" data-a="go" data-path="' + esc(acc) + '" data-drop="1">' + esc(p) + '</button>';
		});
		const el = $('.fvl-crumbs');
		el.innerHTML = html;
		el.scrollLeft = el.scrollWidth;
	}

	function renderToolbar() {
		$('[data-a="back"]').disabled = !S.back.length;
		$('[data-a="forward"]').disabled = !S.fwd.length;
		$('[data-a="up"]').disabled = !S.path;
		$$('.fvl-seg button').forEach((b) => b.classList.toggle('is-on', b.dataset.v === S.view));
		const h = $('[data-a="hidden"]');
		h.classList.toggle('is-on', S.hidden);
		h.innerHTML = ui(S.hidden ? 'eye' : 'eyeOff');
		$('[data-a="details"]').classList.toggle('is-on', S.details);
		const paste = $('.fvl-paste');
		if (paste) {
			paste.hidden = !S.clip;
			if (S.clip) {
				paste.querySelector('span').textContent = 'Paste ' + S.clip.paths.length;
				paste.title = (S.clip.mode === 'move' ? 'Move' : 'Copy') + ' ' + S.clip.paths.length + ' item(s) here (Ctrl+V)';
			}
		}
	}

	/* ================================================================== */
	/* Listing                                                             */
	/* ================================================================== */

	function visible() {
		let list = S.search ? S.search.items : S.items;
		if (!S.search && S.filter) {
			const f = S.filter.toLowerCase();
			list = list.filter((i) => i.name.toLowerCase().indexOf(f) > -1);
		}
		const k = S.sort.k;
		const d = S.sort.d;
		return list.slice().sort((a, b) => {
			if (a.dir !== b.dir) {
				return a.dir ? -1 : 1;
			}
			let r = 0;
			if (k === 'size') {
				r = (a.size || 0) - (b.size || 0);
			} else if (k === 'mtime') {
				r = a.mtime - b.mtime;
			} else if (k === 'type') {
				r = collator.compare(typeName(a), typeName(b));
			}
			if (!r) {
				r = collator.compare(a.name, b.name);
			}
			return r * d;
		});
	}

	function hl(name) {
		const q = S.search ? S.search.q : S.filter;
		if (!q) {
			return esc(name);
		}
		const i = name.toLowerCase().indexOf(q.toLowerCase());
		if (i < 0) {
			return esc(name);
		}
		return esc(name.slice(0, i)) + '<mark>' + esc(name.slice(i, i + q.length)) + '</mark>' + esc(name.slice(i + q.length));
	}

	function thumb(it) {
		let h = '<span class="fvl-ic">' + icon(it) + '</span>';
		if (isImage(it) && it.size < 8 * 1024 * 1024) {
			h += '<img class="fvl-img" loading="lazy" decoding="async" alt="" src="' + esc(rawUrl(it.path)) + '">';
		}
		if (it.link) {
			h += '<span class="fvl-badge-link" title="Symbolic link">' + ui('link') + '</span>';
		}
		if (!it.w && !RO) {
			h += '<span class="fvl-badge-lock" title="Not writable">' + ui('lock') + '</span>';
		}
		return h;
	}

	function card(it, i) {
		return (
			'<div class="fvl-item' + (it.hidden ? ' is-hidden' : '') + (S.clip && S.clip.mode === 'move' && S.clip.paths.indexOf(it.path) > -1 ? ' is-cut' : '') + '" data-i="' + i + '" data-path="' + esc(it.path) + '"' + (it.dir ? ' data-drop="1"' : '') + ' draggable="' + !RO + '" title="' + esc(it.name) + '">' +
			'<div class="fvl-thumb' + (isImage(it) ? ' has-img' : '') + '">' + thumb(it) + '</div>' +
			'<div class="fvl-name">' + hl(it.name) + '</div>' +
			'<div class="fvl-meta">' + (S.search ? esc('/' + parentOf(it.path)) : it.dir ? 'Folder' : fmtSize(it.size)) + '</div>' +
			'<span class="fvl-check">' + ui('check') + '</span>' +
			'</div>'
		);
	}

	function row(it, i) {
		return (
			'<div class="fvl-row' + (it.hidden ? ' is-hidden' : '') + (S.clip && S.clip.mode === 'move' && S.clip.paths.indexOf(it.path) > -1 ? ' is-cut' : '') + '" data-i="' + i + '" data-path="' + esc(it.path) + '"' + (it.dir ? ' data-drop="1"' : '') + ' draggable="' + !RO + '">' +
			'<div class="c-name"><span class="fvl-ico">' + icon(it) + (it.link ? '<span class="fvl-badge-link">' + ui('link') + '</span>' : '') + '</span><span class="fvl-nm" title="' + esc(it.name) + '">' + hl(it.name) + '</span>' + (S.search ? '<span class="fvl-loc">/' + esc(parentOf(it.path)) + '</span>' : '') + '</div>' +
			'<div class="c-size">' + (it.dir ? '—' : fmtSize(it.size)) + '</div>' +
			'<div class="c-type">' + esc(typeName(it)) + '</div>' +
			'<div class="c-date" title="' + esc(fmtDate(it.mtime)) + '">' + esc(relTime(it.mtime)) + '</div>' +
			'<div class="c-perm"><code class="' + (it.w ? '' : 'is-ro') + '" title="' + esc(rwx(it.perms)) + '">' + esc(it.perms) + '</code></div>' +
			'</div>'
		);
	}

	function listHead() {
		const col = (k, label) => {
			const on = S.sort.k === k;
			return '<button class="c-' + k + (on ? ' is-on' : '') + '" data-a="sort" data-k="' + k + '">' + label + (on ? ui('chevronDown', S.sort.d > 0 ? 'fvl-flip' : '') : '') + '</button>';
		};
		return '<div class="fvl-lhead">' + col('name', 'Name') + col('size', 'Size') + col('type', 'Type') + col('mtime', 'Modified') + '<span class="c-perm">Perms</span></div>';
	}

	function emptyState() {
		if (S.search) {
			return '<div class="fvl-empty">' + '<div class="fvl-empty-art">' + ui('search') + '</div><h3>No matches for “' + esc(S.search.q) + '”</h3><p>Nothing in this folder or its subfolders has that name.</p><button class="fvl-btn" data-a="clear-search">Clear search</button></div>';
		}
		if (S.filter) {
			return '<div class="fvl-empty"><div class="fvl-empty-art">' + ui('search') + '</div><h3>No items match “' + esc(S.filter) + '”</h3><p>Press Enter in the search box to look through every subfolder too.</p><button class="fvl-btn fvl-btn-primary" data-a="deep-search">' + ui('search') + 'Search all subfolders</button></div>';
		}
		return (
			'<div class="fvl-empty"><div class="fvl-empty-art is-folder">' + folderIcon({ name: '' }) + '</div><h3>This folder is empty</h3>' +
			(RO || !S.writable
				? '<p>There is nothing here yet.</p>'
				: '<p>Drag files or whole folders here, or create something new.</p><div class="fvl-empty-actions"><button class="fvl-btn fvl-btn-primary" data-a="upload">' + ui('upload') + 'Upload files</button><button class="fvl-btn" data-a="new-folder">' + ui('folderPlus') + 'New folder</button><button class="fvl-btn" data-a="new-file">' + ui('filePlus') + 'New file</button></div>') +
			'</div>'
		);
	}

	function skeleton() {
		let h = '';
		for (let i = 0; i < 18; i++) {
			h += S.view === 'grid' ? '<div class="fvl-item fvl-sk"><div class="fvl-thumb"></div><div class="fvl-name"></div><div class="fvl-meta"></div></div>' : '<div class="fvl-row fvl-sk"><div class="c-name"></div></div>';
		}
		return h;
	}

	function renderList() {
		S.list = visible();
		const el = $('.fvl-list');
		el.className = 'fvl-list is-' + S.view;
		if (S.loading && !S.items.length && !S.search) {
			el.innerHTML = skeleton();
		} else if (!S.list.length) {
			el.className += ' is-empty';
			el.innerHTML = emptyState();
		} else {
			let h = S.view === 'list' ? listHead() : '';
			for (let i = 0; i < S.list.length; i++) {
				h += S.view === 'grid' ? card(S.list[i], i) : row(S.list[i], i);
			}
			el.innerHTML = h;
		}
		renderBanner();
		syncSel();
	}

	function renderBanner() {
		const b = $('.fvl-banner');
		if (S.search) {
			b.hidden = false;
			b.innerHTML =
				ui('search') +
				'<span><b>' + S.search.items.length + (S.search.partial ? '+' : '') + '</b> result' + (S.search.items.length === 1 ? '' : 's') + ' for “<b>' + esc(S.search.q) + '</b>” in <code>/' + esc(S.path) + '</code>' +
				(S.search.partial ? ' <em>(stopped early — refine your search)</em>' : '') + '</span>' +
				'<button class="fvl-btn fvl-btn-sm" data-a="clear-search">' + ui('x') + 'Clear</button>';
		} else if (S.truncated) {
			b.hidden = false;
			b.innerHTML = ui('info') + '<span>This folder is very large — only the first 10,000 items are shown. Use search to find specific files.</span>';
		} else {
			b.hidden = true;
		}
	}

	function renderStatus() {
		const list = S.list;
		let files = 0;
		let dirs = 0;
		let size = 0;
		list.forEach((i) => {
			if (i.dir) {
				dirs++;
			} else {
				files++;
				size += i.size || 0;
			}
		});
		let left = '<span>' + dirs + ' folder' + (dirs === 1 ? '' : 's') + '</span><span>' + files + ' file' + (files === 1 ? '' : 's') + '</span><span>' + fmtSize(size) + '</span>';
		if (S.sel.size) {
			left += '<span class="fvl-st-sel">' + S.sel.size + ' selected</span>';
		}
		let right = '';
		if (S.clip) {
			right += '<span class="fvl-st-clip">' + ui(S.clip.mode === 'move' ? 'scissors' : 'copy') + S.clip.paths.length + ' on clipboard <button data-a="clear-clip" title="Clear clipboard">' + ui('x') + '</button></span>';
		}
		right += RO ? '<span class="fvl-st-ro">' + ui('lock') + 'Read-only mode</span>' : !S.writable ? '<span class="fvl-st-ro">' + ui('lock') + 'Folder not writable</span>' : '<span class="fvl-st-ok">' + ui('check') + 'Writable</span>';
		$('.fvl-status').innerHTML = '<div class="fvl-st-l">' + left + '</div><div class="fvl-st-r">' + right + '</div>';
	}

	/* ================================================================== */
	/* Navigation                                                          */
	/* ================================================================== */

	function setLoading(on) {
		S.loading = on;
		shellEl().classList.toggle('is-loading', on);
	}

	async function go(path, opts) {
		opts = opts || {};
		const prev = S.path;
		setLoading(true);
		if (prev !== path) {
			S.items = [];
			renderList();
		}
		try {
			const d = await api('list', { path: path, hidden: S.hidden });
			if (opts.push !== false && prev !== null && prev !== d.path) {
				S.back.push(prev);
				S.fwd = [];
			}
			S.path = d.path;
			S.items = d.items;
			S.writable = d.w;
			S.truncated = d.truncated;
			if (!opts.keepSearch) {
				S.search = null;
			}
			if (!opts.keepFilter) {
				S.filter = '';
				$('#fvl-q').value = '';
			}
			if (opts.select) {
				S.sel = new Set(opts.select);
			} else if (!opts.keepSel) {
				S.sel.clear();
			} else {
				const have = new Set(S.items.map((i) => i.path));
				S.sel = new Set([...S.sel].filter((p) => have.has(p)));
			}
			S.focus = -1;
			infoCache.clear();
			try {
				history.replaceState(null, '', '#' + encodeURIComponent(S.path));
			} catch (e) {
				/* ignore */
			}
			renderCrumbs();
			renderToolbar();
			renderList();
			treeReveal(S.path);
			if (opts.select && opts.select.length) {
				const el = $(sel(opts.select[0]), $('.fvl-list'));
				if (el) {
					el.scrollIntoView({ block: 'nearest' });
				}
			}
		} catch (e) {
			toast(e.message, 'error');
			if (prev === null && path !== '') {
				setLoading(false);
				return go('', { push: false });
			}
			renderList();
		} finally {
			setLoading(false);
			renderList();
		}
	}

	const refresh = (opts) => {
		if (S.search && !(opts && opts.select)) {
			return runSearch(S.search.q);
		}
		return go(S.path, Object.assign({ push: false, keepSel: true, keepFilter: true }, opts || {}));
	};

	async function runSearch(q) {
		q = (q || '').trim();
		if (q.length < 2) {
			toast('Type at least 2 characters to search subfolders.', 'info');
			return;
		}
		setLoading(true);
		try {
			const d = await api('search', { path: S.path, q: q, hidden: S.hidden });
			S.search = { q: q, items: d.items, partial: d.partial };
			S.sel.clear();
			renderList();
		} catch (e) {
			toast(e.message, 'error');
		} finally {
			setLoading(false);
		}
	}

	function clearSearch() {
		S.search = null;
		S.filter = '';
		$('#fvl-q').value = '';
		S.sel.clear();
		renderList();
	}

	/* ================================================================== */
	/* Folder tree                                                         */
	/* ================================================================== */

	const treeLoaded = new Map();

	function treeNode(name, path, depth, hidden) {
		return (
			'<div class="fvl-tn" data-tn="' + esc(path) + '" role="treeitem">' +
			'<div class="fvl-tn-row" data-a="go" data-path="' + esc(path) + '" data-drop="1" style="--d:' + depth + '" title="' + esc(path ? '/' + path : C.rootPath) + '">' +
			'<span class="fvl-tn-tog" data-a="tree-toggle" data-path="' + esc(path) + '">' + ui('chevronRight') + '</span>' +
			'<span class="fvl-tn-ico">' + (depth === 0 ? LOGO : folderIcon({ name: name, hidden: hidden })) + '</span>' +
			'<span class="fvl-tn-name">' + esc(name) + '</span>' +
			'</div><div class="fvl-tn-kids" role="group"></div></div>'
		);
	}

	const tnEl = (path) => $('[data-tn="' + CSS.escape(path) + '"]', $('.fvl-tree'));

	async function treeLoad(path, force) {
		const node = tnEl(path);
		if (!node) {
			return;
		}
		if (treeLoaded.has(path) && !force) {
			return;
		}
		try {
			const d = await api('tree', { path: path, hidden: S.hidden });
			const depth = path ? path.split('/').length + 1 : 1;
			const items = d.items.slice().sort((a, b) => collator.compare(a.name, b.name));
			const kids = node.querySelector('.fvl-tn-kids');
			const openKids = force ? $$('.fvl-tn.is-open', kids).map((n) => n.dataset.tn) : [];
			kids.innerHTML = items.map((it) => treeNode(it.name, it.path, depth, it.hidden)).join('');
			node.classList.toggle('is-leaf', !items.length);
			treeLoaded.set(path, true);
			for (const p of openKids) {
				treeLoaded.delete(p);
				if (tnEl(p)) {
					tnEl(p).classList.add('is-open');
					await treeLoad(p);
				}
			}
		} catch (e) {
			node.classList.add('is-leaf');
		}
	}

	async function treeToggle(path, open) {
		const node = tnEl(path);
		if (!node) {
			return;
		}
		const willOpen = open === undefined ? !node.classList.contains('is-open') : open;
		if (willOpen) {
			await treeLoad(path);
		}
		node.classList.toggle('is-open', willOpen);
	}

	async function treeReveal(path) {
		const parts = path ? path.split('/') : [];
		let acc = '';
		await treeToggle('', true);
		for (let i = 0; i < parts.length - 1; i++) {
			acc = join(acc, parts[i]);
			await treeToggle(acc, true);
		}
		$$('.fvl-tn-row.is-active', $('.fvl-tree')).forEach((r) => r.classList.remove('is-active'));
		const n = tnEl(path);
		if (n) {
			const r = n.querySelector('.fvl-tn-row');
			r.classList.add('is-active');
			const tree = $('.fvl-tree');
			const tr = tree.getBoundingClientRect();
			const rr = r.getBoundingClientRect();
			if (rr.top < tr.top || rr.bottom > tr.bottom) {
				r.scrollIntoView({ block: 'center' });
			}
		}
		$$('.fvl-q', $('.fvl-quick')).forEach((q) => q.classList.toggle('is-active', q.dataset.path === path));
	}

	function treeRefresh(paths) {
		(paths || [S.path]).forEach((p) => {
			if (treeLoaded.has(p)) {
				treeLoad(p, true);
			}
		});
	}

	/* ================================================================== */
	/* Selection                                                           */
	/* ================================================================== */

	const selected = () => S.list.filter((i) => S.sel.has(i.path));

	function syncSel() {
		$$('.fvl-item[data-i], .fvl-row[data-i]', $('.fvl-list')).forEach((el) => {
			el.classList.toggle('is-sel', S.sel.has(el.dataset.path));
			el.classList.toggle('is-focus', +el.dataset.i === S.focus);
		});
		renderSelbar();
		renderStatus();
		renderDetails();
	}

	function selectOnly(path) {
		S.sel = new Set(path ? [path] : []);
		S.anchor = path;
		syncSel();
	}

	function onItemClick(el, e) {
		const i = +el.dataset.i;
		const it = S.list[i];
		if (!it) {
			return;
		}
		if (e.shiftKey && S.anchor) {
			const a = S.list.findIndex((x) => x.path === S.anchor);
			const [from, to] = a < i ? [a, i] : [i, a];
			if (!(e.ctrlKey || e.metaKey)) {
				S.sel.clear();
			}
			for (let k = from; k <= to; k++) {
				S.sel.add(S.list[k].path);
			}
		} else if (e.ctrlKey || e.metaKey || e.target.closest('.fvl-check')) {
			if (S.sel.has(it.path)) {
				S.sel.delete(it.path);
			} else {
				S.sel.add(it.path);
			}
			S.anchor = it.path;
		} else {
			S.sel = new Set([it.path]);
			S.anchor = it.path;
		}
		S.focus = i;
		syncSel();
	}

	function renderSelbar() {
		const bar = $('.fvl-selbar');
		const items = selected();
		if (!items.length) {
			bar.hidden = true;
			return;
		}
		const one = items.length === 1 ? items[0] : null;
		const b = (a, ic, label, cls) => '<button class="fvl-sb' + (cls ? ' ' + cls : '') + '" data-a="' + a + '" title="' + esc(label) + '">' + ui(ic) + '<span>' + label + '</span></button>';
		let h = '<button class="fvl-sb fvl-sb-x" data-a="clear-sel" title="Clear selection (Esc)">' + ui('x') + '</button><span class="fvl-sb-count">' + items.length + ' selected</span><div class="fvl-sb-actions">';
		if (one) {
			h += b('open', one.dir ? 'folderOpen' : isEditable(one) ? 'code' : 'eye', one.dir ? 'Open' : isEditable(one) && !isImage(one) ? 'Edit' : 'Open');
		}
		h += b('download', 'download', 'Download');
		if (!RO) {
			h += b('copy', 'copy', 'Copy') + b('cut', 'scissors', 'Cut');
			if (one) {
				h += b('rename', 'pencil', 'Rename');
			}
			h += b('duplicate', 'copy', 'Duplicate', 'fvl-hide-s') + b('compress', 'archive', 'Zip');
			if (one && isZip(one)) {
				h += b('extract', 'unarchive', 'Extract');
			}
			if (one) {
				h += b('chmod', 'lock', 'Permissions', 'fvl-hide-s');
			}
			h += b('delete', 'trash', 'Delete', 'is-danger');
		}
		bar.innerHTML = h + '</div>';
		bar.hidden = false;
	}

	/* ================================================================== */
	/* Details panel                                                       */
	/* ================================================================== */

	let detailsToken = 0;

	function drow(label, value, extra) {
		return '<div class="fvl-dr"><dt>' + label + '</dt><dd>' + value + (extra || '') + '</dd></div>';
	}

	function renderDetails() {
		if (!S.details) {
			return;
		}
		const el = $('.fvl-details');
		const items = selected();
		const token = ++detailsToken;

		if (items.length > 1) {
			let size = 0;
			let dirs = 0;
			items.forEach((i) => {
				if (i.dir) {
					dirs++;
				} else {
					size += i.size || 0;
				}
			});
			const stack = items
				.slice(0, 3)
				.map((it, k) => '<span style="--k:' + k + '">' + icon(it) + '</span>')
				.join('');
			el.innerHTML =
				'<div class="fvl-d-head"><div class="fvl-d-stack">' + stack + '</div><h3>' + items.length + ' items selected</h3><p>' + dirs + ' folder' + (dirs === 1 ? '' : 's') + ', ' + (items.length - dirs) + ' file' + (items.length - dirs === 1 ? '' : 's') + '</p></div>' +
				'<dl class="fvl-dl">' + drow('Files size', fmtSize(size)) + (dirs ? drow('Note', '<span class="fvl-muted">Folder sizes are not included</span>') : '') + '</dl>' +
				'<div class="fvl-d-actions">' +
				'<button class="fvl-btn" data-a="download">' + ui('download') + 'Download as ZIP</button>' +
				(RO ? '' : '<button class="fvl-btn" data-a="compress">' + ui('archive') + 'Compress</button><button class="fvl-btn is-danger" data-a="delete">' + ui('trash') + 'Delete</button>') +
				'</div>';
			return;
		}

		if (!items.length) {
			let files = 0;
			let dirs = 0;
			let size = 0;
			S.items.forEach((i) => {
				if (i.dir) {
					dirs++;
				} else {
					files++;
					size += i.size || 0;
				}
			});
			const name = S.path ? baseOf(S.path) : C.site || C.rootName;
			el.innerHTML =
				'<div class="fvl-d-head"><div class="fvl-d-prev is-folder">' + (S.path ? folderIcon({ name: name }) : LOGO) + '</div><h3>' + esc(name) + '</h3><p>' + (S.path ? 'Current folder' : 'Website root') + '</p></div>' +
				'<dl class="fvl-dl">' +
				drow('Folders', dirs) +
				drow('Files', files) +
				drow('Files size', fmtSize(size)) +
				drow('Total size', '<span class="fvl-dsize">—</span>', ' <button class="fvl-link" data-a="dirsize" data-path="' + esc(S.path) + '">' + ui('sigma') + 'Calculate</button>') +
				drow('Location', '<code class="fvl-path">/' + esc(S.path) + '</code>', '<button class="fvl-mini" data-a="copy-path" data-path="' + esc(S.path) + '" title="Copy full path">' + ui('copy') + '</button>') +
				drow('Access', S.writable && !RO ? '<span class="fvl-ok">Read &amp; write</span>' : '<span class="fvl-warn">Read only</span>') +
				'</dl>' +
				'<div class="fvl-d-tip">' + ui('info') + '<span>Select a file to see its details. Double-click to open. Right-click for more actions.</span></div>';
			return;
		}

		const it = items[0];
		const head = (inner) =>
			'<div class="fvl-d-head">' +
			(isImage(it) ? '<div class="fvl-d-prev is-img"><img src="' + esc(rawUrl(it.path)) + '" alt=""></div>' : '<div class="fvl-d-prev">' + icon(it) + '</div>') +
			'<h3 title="' + esc(it.name) + '">' + esc(it.name) + '</h3><p>' + esc(typeName(it)) + '</p></div>' + inner;

		el.innerHTML = head('<div class="fvl-dl fvl-d-loading"><span></span><span></span><span></span><span></span></div>');

		const cached = infoCache.get(it.path);
		const show = (info) => {
			if (token !== detailsToken) {
				return;
			}
			infoCache.set(it.path, info);
			const perms = info.perms + ' <span class="fvl-muted">' + rwx(info.perms) + '</span>';
			let dl = '<dl class="fvl-dl">';
			if (info.dir) {
				dl += drow('Contents', (info.folders || 0) + ' folders, ' + (info.files || 0) + ' files');
				dl += drow('Total size', '<span class="fvl-dsize">—</span>', ' <button class="fvl-link" data-a="dirsize" data-path="' + esc(info.path) + '">' + ui('sigma') + 'Calculate</button>');
			} else {
				dl += drow('Size', fmtSize(info.size) + ' <span class="fvl-muted">(' + Number(info.size).toLocaleString() + ' bytes)</span>');
				if (info.width) {
					dl += drow('Dimensions', info.width + ' × ' + info.height + ' px');
				}
				dl += drow('MIME type', '<code>' + esc(info.mime) + '</code>');
			}
			dl += drow('Modified', esc(fmtDate(info.mtime)));
			dl += drow('Changed', esc(fmtDate(info.ctime)));
			dl += drow('Permissions', '<code>' + perms + '</code>', RO ? '' : ' <button class="fvl-link" data-a="chmod">' + ui('pencil') + 'Change</button>');
			if (info.owner) {
				dl += drow('Owner', esc(info.owner) + (info.group ? ' <span class="fvl-muted">/ ' + esc(info.group) + '</span>' : ''));
			}
			dl += drow('Access', (info.readable ? 'Readable' : '<span class="fvl-warn">Not readable</span>') + ' · ' + (info.w ? '<span class="fvl-ok">Writable</span>' : '<span class="fvl-warn">Not writable</span>'));
			if (info.link) {
				dl += drow('Type', 'Symbolic link');
			}
			dl += drow('Location', '<code class="fvl-path">/' + esc(info.path) + '</code>', '<button class="fvl-mini" data-a="copy-path" data-path="' + esc(info.path) + '" title="Copy full server path">' + ui('copy') + '</button>');
			if (info.url) {
				dl += drow('Public URL', '<a class="fvl-url" href="' + esc(info.url) + '" target="_blank" rel="noopener noreferrer">' + esc(info.url.replace(/^https?:\/\//, '')) + '</a>', '<button class="fvl-mini" data-a="copy-url" data-url="' + esc(info.url) + '" title="Copy URL">' + ui('copy') + '</button>');
			}
			dl += '</dl>';
			let act = '<div class="fvl-d-actions">';
			act += '<button class="fvl-btn fvl-btn-primary" data-a="open">' + ui(it.dir ? 'folderOpen' : isPreviewable(it) ? 'eye' : isEditable(it) ? 'code' : 'download') + (it.dir ? 'Open folder' : isPreviewable(it) ? 'Preview' : isEditable(it) ? 'Edit file' : isZip(it) ? 'Extract' : 'Download') + '</button>';
			act += '<button class="fvl-btn" data-a="download">' + ui('download') + (it.dir ? 'Download ZIP' : 'Download') + '</button>';
			if (!RO) {
				act += '<button class="fvl-btn" data-a="rename">' + ui('pencil') + 'Rename</button><button class="fvl-btn is-danger" data-a="delete">' + ui('trash') + 'Delete</button>';
			}
			act += '</div>';
			el.innerHTML = head(dl + act);
		};
		if (cached) {
			show(cached);
		} else {
			api('info', { path: it.path })
				.then(show)
				.catch((e) => {
					if (token === detailsToken) {
						el.innerHTML = head('<p class="fvl-warn fvl-pad">' + esc(e.message) + '</p>');
					}
				});
		}
	}

	/* ================================================================== */
	/* Toasts                                                              */
	/* ================================================================== */

	function toast(msg, type, ms) {
		type = type || 'info';
		const ic = { success: 'check', error: 'x', info: 'info', warn: 'info' }[type] || 'info';
		const t = document.createElement('div');
		t.className = 'fvl-toast is-' + type;
		t.innerHTML = '<span class="fvl-toast-ic">' + ui(ic) + '</span><span class="fvl-toast-msg">' + esc(msg) + '</span><button aria-label="Dismiss">' + ui('x') + '</button>';
		$('.fvl-toasts').appendChild(t);
		reveal(t);
		const kill = () => {
			t.classList.remove('is-in');
			setTimeout(() => t.remove(), 250);
		};
		t.querySelector('button').onclick = kill;
		setTimeout(kill, ms || (type === 'error' ? 7000 : 3500));
	}

	/* ================================================================== */
	/* Modals                                                              */
	/* ================================================================== */

	function pushLayer(el, close) {
		const layer = { el: el, close: close };
		layers.push(layer);
		return () => {
			const i = layers.indexOf(layer);
			if (i > -1) {
				layers.splice(i, 1);
			}
		};
	}

	function modal(opts) {
		return new Promise((resolve) => {
			const wrap = document.createElement('div');
			wrap.className = 'fvl-overlay';
			wrap.innerHTML =
				'<div class="fvl-modal ' + (opts.cls || '') + '" role="dialog" aria-modal="true">' +
				'<div class="fvl-modal-head">' + (opts.icon ? '<span class="fvl-modal-ic' + (opts.danger ? ' is-danger' : '') + '">' + ui(opts.icon) + '</span>' : '') + '<h2>' + esc(opts.title) + '</h2><button class="fvl-ib" data-m="close" aria-label="Close">' + ui('x') + '</button></div>' +
				'<div class="fvl-modal-body">' + (opts.body || '') + '</div>' +
				'<div class="fvl-modal-foot">' +
				(opts.buttons || [])
					.map((b, i) => '<button class="fvl-btn' + (b.primary ? (b.danger ? ' fvl-btn-danger' : ' fvl-btn-primary') : '') + '" data-m="' + i + '">' + esc(b.label) + '</button>')
					.join('') +
				'</div></div>';
			shellEl().appendChild(wrap);
			reveal(wrap);
			let done = false;
			const finish = (val) => {
				if (done) {
					return;
				}
				done = true;
				pop();
				wrap.classList.remove('is-in');
				setTimeout(() => wrap.remove(), 180);
				resolve(val);
			};
			const pop = pushLayer(wrap, () => finish(null));
			wrap.addEventListener('mousedown', (e) => {
				if (e.target === wrap) {
					finish(null);
				}
			});
			wrap.addEventListener('click', (e) => {
				const b = e.target.closest('[data-m]');
				if (!b) {
					return;
				}
				if (b.dataset.m === 'close') {
					return finish(null);
				}
				const btn = opts.buttons[+b.dataset.m];
				const v = btn.value !== undefined ? btn.value : true;
				if (btn.validate && !btn.validate(wrap)) {
					return;
				}
				finish(typeof v === 'function' ? v(wrap) : v);
			});
			wrap.addEventListener('keydown', (e) => {
				if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
					e.preventDefault();
					const pi = (opts.buttons || []).findIndex((b) => b.primary);
					if (pi > -1) {
						wrap.querySelector('[data-m="' + pi + '"]').click();
					}
				}
			});
			if (opts.onOpen) {
				opts.onOpen(wrap);
			} else {
				const p = wrap.querySelector('.fvl-btn-primary, .fvl-btn-danger');
				if (p) {
					p.focus();
				}
			}
		});
	}

	function promptName(title, value, opts) {
		opts = opts || {};
		return modal({
			title: title,
			icon: opts.icon || 'pencil',
			body: '<label class="fvl-field-l"><span>' + esc(opts.label || 'Name') + '</span><input type="text" class="fvl-input" value="' + esc(value) + '" spellcheck="false" autocomplete="off"></label>' + (opts.hint ? '<p class="fvl-hint">' + esc(opts.hint) + '</p>' : '') + '<p class="fvl-err" hidden></p>',
			buttons: [
				{ label: 'Cancel', value: null },
				{
					label: opts.ok || 'Save',
					primary: true,
					validate: (w) => {
						const v = w.querySelector('input').value.trim();
						const err = w.querySelector('.fvl-err');
						let msg = '';
						if (!v) {
							msg = 'Please enter a name.';
						} else if (/[\/\\<>:"|?*\x00-\x1f]/.test(v) || v === '.' || v === '..') {
							msg = 'Names cannot contain / \\ < > : " | ? *';
						}
						err.hidden = !msg;
						err.textContent = msg;
						return !msg;
					},
					value: (w) => w.querySelector('input').value.trim(),
				},
			],
			onOpen: (w) => {
				const inp = w.querySelector('input');
				inp.focus();
				const dot = opts.selectBase ? value.lastIndexOf('.') : -1;
				inp.setSelectionRange(0, dot > 0 ? dot : value.length);
			},
		});
	}

	function confirmBox(title, html, opts) {
		opts = opts || {};
		return modal({
			title: title,
			icon: opts.icon || (opts.danger ? 'trash' : 'info'),
			danger: opts.danger,
			body: '<div class="fvl-confirm">' + html + '</div>',
			buttons: [
				{ label: opts.cancel || 'Cancel', value: false },
				{ label: opts.ok || 'OK', primary: true, danger: opts.danger, value: true },
			],
		}).then((v) => !!v);
	}

	/* ================================================================== */
	/* Actions                                                             */
	/* ================================================================== */

	function targetItems(el) {
		if (el && el.dataset && el.dataset.path !== undefined && el.closest('.fvl-list')) {
			const it = S.list.find((i) => i.path === el.dataset.path);
			return it ? [it] : [];
		}
		return selected();
	}

	function openItem(it) {
		if (!it) {
			return;
		}
		if (it.dir) {
			return go(it.path);
		}
		if (isPreviewable(it)) {
			return openPreview(it);
		}
		if (isEditable(it)) {
			return openEditor(it);
		}
		if (isZip(it) && !RO) {
			return extract(it);
		}
		return downloadItems([it]);
	}

	async function newFolder() {
		const name = await promptName('New folder', 'New folder', { icon: 'folderPlus', ok: 'Create', label: 'Folder name' });
		if (!name) {
			return;
		}
		try {
			const r = await api('mkdir', { path: S.path, name: name });
			toast('Folder “' + name + '” created', 'success');
			await refresh({ select: [r.path] });
			treeRefresh();
		} catch (e) {
			toast(e.message, 'error');
		}
	}

	async function newFile() {
		const name = await promptName('New file', 'untitled.txt', { icon: 'filePlus', ok: 'Create', label: 'File name', selectBase: true, hint: 'Tip: the extension decides syntax highlighting — e.g. .php, .css, .js, .html' });
		if (!name) {
			return;
		}
		try {
			const r = await api('mkfile', { path: S.path, name: name });
			toast('File “' + name + '” created', 'success');
			await refresh({ select: [r.path] });
			const it = S.items.find((i) => i.path === r.path);
			if (it && isEditable(it)) {
				openEditor(it);
			}
		} catch (e) {
			toast(e.message, 'error');
		}
	}

	async function renameItem(it) {
		if (!it) {
			return;
		}
		const name = await promptName('Rename', it.name, { selectBase: !it.dir, ok: 'Rename', label: 'New name' });
		if (!name || name === it.name) {
			return;
		}
		try {
			const r = await api('rename', { path: it.path, name: name });
			toast('Renamed to “' + name + '”', 'success');
			await refresh({ select: [r.path] });
			if (it.dir) {
				treeRefresh([parentOf(it.path)]);
			}
		} catch (e) {
			toast(e.message, 'error');
		}
	}

	async function deleteItems(items) {
		if (!items.length) {
			return;
		}
		const dirs = items.filter((i) => i.dir).length;
		const what = items.length === 1 ? '<b>' + esc(items[0].name) + '</b>' : '<b>' + items.length + ' items</b>';
		const ok = await confirmBox(
			items.length === 1 ? 'Delete ' + (items[0].dir ? 'folder' : 'file') + '?' : 'Delete ' + items.length + ' items?',
			'<p>' + what + ' will be permanently deleted from the server' + (dirs ? ', including everything inside ' + (dirs === 1 && items.length === 1 ? 'this folder' : 'the selected folders') : '') + '.</p><p class="fvl-warn">This cannot be undone.</p>',
			{ danger: true, ok: 'Delete permanently' }
		);
		if (!ok) {
			return;
		}
		try {
			const r = await api('delete', { paths: items.map((i) => i.path) });
			toast('Deleted ' + r.count + ' item' + (r.count === 1 ? '' : 's'), 'success');
			S.sel.clear();
			await refresh();
			if (dirs) {
				treeRefresh();
			}
		} catch (e) {
			toast(e.message, 'error');
			refresh();
		}
	}

	function toClipboard(items, mode) {
		if (!items.length) {
			return;
		}
		S.clip = { mode: mode, paths: items.map((i) => i.path) };
		toast(items.length + ' item' + (items.length === 1 ? '' : 's') + (mode === 'move' ? ' cut' : ' copied') + ' — open a folder and press Paste', 'info');
		renderToolbar();
		renderList();
	}

	async function paste(dest, paths, mode) {
		if (RO) {
			return;
		}
		dest = dest === undefined ? S.path : dest;
		paths = paths || (S.clip && S.clip.paths);
		mode = mode || (S.clip && S.clip.mode);
		if (!paths || !paths.length) {
			return;
		}
		setLoading(true);
		try {
			const r = await api('paste', { paths: paths, dest: dest, mode: mode });
			const n = r.paths.length;
			toast(n ? (mode === 'move' ? 'Moved ' : 'Copied ') + n + ' item' + (n === 1 ? '' : 's') : 'Nothing to move — items are already here', n ? 'success' : 'info');
			if (mode === 'move' && S.clip && paths === S.clip.paths) {
				S.clip = null;
			}
			await refresh(dest === S.path ? { select: r.paths } : {});
			treeRefresh(['', S.path, dest].concat(paths.map(parentOf)));
		} catch (e) {
			toast(e.message, 'error');
			refresh();
		} finally {
			setLoading(false);
		}
	}

	async function duplicate(items) {
		if (!items.length) {
			return;
		}
		try {
			const r = await api('duplicate', { paths: items.map((i) => i.path) });
			toast('Duplicated ' + r.paths.length + ' item' + (r.paths.length === 1 ? '' : 's'), 'success');
			await refresh({ select: r.paths });
			if (items.some((i) => i.dir)) {
				treeRefresh();
			}
		} catch (e) {
			toast(e.message, 'error');
		}
	}

	async function compress(items) {
		if (!items.length) {
			return;
		}
		const def0 = items.length === 1 ? items[0].name.replace(/\.[^.]+$/, '') || items[0].name : S.path ? baseOf(S.path) : 'archive';
		const name = await promptName('Compress to ZIP', def0 + '.zip', { icon: 'archive', ok: 'Create ZIP', label: 'Archive name', selectBase: true });
		if (!name) {
			return;
		}
		setLoading(true);
		toast('Creating archive…', 'info');
		try {
			const r = await api('compress', { path: S.path, paths: items.map((i) => i.path), name: name });
			toast('Archive created: ' + baseOf(r.path), 'success');
			await refresh({ select: [r.path] });
		} catch (e) {
			toast(e.message, 'error');
		} finally {
			setLoading(false);
		}
	}

	async function extract(it) {
		const folder = it.name.replace(/\.zip$/i, '');
		const choice = await modal({
			title: 'Extract archive',
			icon: 'unarchive',
			body: '<p>Extract <b>' + esc(it.name) + '</b> (' + fmtSize(it.size) + ')</p>' +
				'<label class="fvl-radio"><input type="radio" name="fvl-x" value="folder" checked><span><b>Into a new folder</b><small>/' + esc(join(parentOf(it.path), folder)) + '/</small></span></label>' +
				'<label class="fvl-radio"><input type="radio" name="fvl-x" value="here"><span><b>Here</b><small>Files are added next to the archive; existing files with the same name are replaced</small></span></label>',
			buttons: [
				{ label: 'Cancel', value: null },
				{ label: 'Extract', primary: true, value: (w) => w.querySelector('input[name="fvl-x"]:checked').value },
			],
		});
		if (!choice) {
			return;
		}
		setLoading(true);
		try {
			const r = await api('extract', { path: it.path, here: choice === 'here' });
			toast('Extracted ' + r.count + ' file' + (r.count === 1 ? '' : 's'), 'success');
			await refresh(choice === 'here' ? {} : { select: [r.path] });
			treeRefresh();
		} catch (e) {
			toast(e.message, 'error');
		} finally {
			setLoading(false);
		}
	}

	function downloadItems(items) {
		if (!items.length) {
			return;
		}
		if (items.length === 1 && !items[0].dir) {
			$('.fvl-dl-frame').src = rawUrl(items[0].path, true);
			toast('Downloading ' + items[0].name, 'info');
			return;
		}
		const f = document.createElement('form');
		f.method = 'POST';
		f.action = C.ajax;
		f.target = 'fvl-dl';
		f.hidden = true;
		const add = (n, v) => {
			const i = document.createElement('input');
			i.type = 'hidden';
			i.name = n;
			i.value = v;
			f.appendChild(i);
		};
		add('action', 'fivelle_fe_zip');
		add('nonce', C.nonce);
		add('paths', JSON.stringify(items.map((i) => i.path)));
		shellEl().appendChild(f);
		f.submit();
		f.remove();
		toast('Preparing ZIP download…', 'info');
	}

	async function chmodItem(it) {
		if (!it) {
			return;
		}
		const cur = String(it.perms || '0644').slice(-3);
		const grid = ['Owner', 'Group', 'Public']
			.map((who, wi) => '<tr><th>' + who + '</th>' + ['Read', 'Write', 'Execute'].map((p, pi) => '<td><label class="fvl-cb"><input type="checkbox" data-w="' + wi + '" data-b="' + [4, 2, 1][pi] + '"><span></span></label></td>').join('') + '</tr>')
			.join('');
		const v = await modal({
			title: 'Permissions',
			icon: 'lock',
			cls: 'fvl-chmod',
			body: '<p class="fvl-muted">' + esc(it.name) + '</p><table class="fvl-perm"><thead><tr><th></th><th>Read</th><th>Write</th><th>Execute</th></tr></thead><tbody>' + grid + '</tbody></table>' +
				'<label class="fvl-field-l fvl-inline"><span>Numeric value</span><input type="text" class="fvl-input fvl-oct" maxlength="4" value="' + cur + '"><code class="fvl-rwx"></code></label>' +
				'<p class="fvl-hint">Common: 644 for files, 755 for folders. Avoid 777.</p>',
			buttons: [
				{ label: 'Cancel', value: null },
				{ label: 'Apply', primary: true, value: (w) => w.querySelector('.fvl-oct').value.trim() },
			],
			onOpen: (w) => {
				const oct = w.querySelector('.fvl-oct');
				const boxes = $$('input[type="checkbox"]', w);
				const fromOct = () => {
					const o = oct.value.trim().slice(-3);
					if (!/^[0-7]{3}$/.test(o)) {
						return;
					}
					boxes.forEach((b) => (b.checked = !!(parseInt(o[+b.dataset.w], 8) & +b.dataset.b)));
					w.querySelector('.fvl-rwx').textContent = rwx(o);
				};
				const fromBoxes = () => {
					const d = [0, 0, 0];
					boxes.forEach((b) => {
						if (b.checked) {
							d[+b.dataset.w] += +b.dataset.b;
						}
					});
					oct.value = d.join('');
					w.querySelector('.fvl-rwx').textContent = rwx(oct.value);
				};
				oct.addEventListener('input', fromOct);
				boxes.forEach((b) => b.addEventListener('change', fromBoxes));
				fromOct();
				oct.focus();
				oct.select();
			},
		});
		if (!v) {
			return;
		}
		try {
			const r = await api('chmod', { path: it.path, mode: v });
			toast('Permissions set to ' + r.perms, 'success');
			await refresh({ select: [it.path] });
		} catch (e) {
			toast(e.message, 'error');
		}
	}

	async function dirSize(path, btn) {
		const out = btn && btn.closest('dd') && btn.closest('dd').querySelector('.fvl-dsize');
		if (btn) {
			btn.disabled = true;
			btn.innerHTML = '<span class="fvl-spinner"></span>Calculating…';
		}
		try {
			const r = await api('dirsize', { path: path });
			if (out) {
				out.innerHTML = fmtSize(r.size) + ' <span class="fvl-muted">· ' + r.files.toLocaleString() + ' files, ' + r.dirs.toLocaleString() + ' folders' + (r.partial ? ' (partial)' : '') + '</span>';
			}
			if (btn) {
				btn.remove();
			}
		} catch (e) {
			toast(e.message, 'error');
			if (btn) {
				btn.disabled = false;
				btn.innerHTML = ui('sigma') + 'Calculate';
			}
		}
	}

	function absPath(rel) {
		const sep = C.rootPath.indexOf('\\') > -1 && C.rootPath.indexOf('/') === -1 ? '\\' : '/';
		return rel ? C.rootPath.replace(/[\\/]+$/, '') + sep + rel.split('/').join(sep) : C.rootPath;
	}

	/* ================================================================== */
	/* Editor                                                              */
	/* ================================================================== */

	function modeFor(ext) {
		const m = {
			php: 'application/x-httpd-php', phtml: 'application/x-httpd-php', inc: 'application/x-httpd-php',
			js: 'javascript', mjs: 'javascript', cjs: 'javascript',
			json: { name: 'javascript', json: true }, map: { name: 'javascript', json: true },
			ts: 'text/typescript', tsx: 'text/typescript-jsx', jsx: 'jsx',
			css: 'css', scss: 'text/x-scss', less: 'text/x-less', sass: 'text/x-sass',
			html: 'htmlmixed', htm: 'htmlmixed', vue: 'htmlmixed', twig: 'htmlmixed', tpl: 'htmlmixed',
			xml: 'xml', svg: 'xml',
			md: 'markdown', markdown: 'markdown',
			sql: 'text/x-mysql',
			sh: 'shell', bash: 'shell', zsh: 'shell',
			yml: 'yaml', yaml: 'yaml',
			conf: 'nginx',
		};
		return m[ext] || 'text/plain';
	}

	async function openEditor(it) {
		let d;
		setLoading(true);
		try {
			d = await api('read', { path: it.path });
		} catch (e) {
			toast(e.message, 'error');
			if (/binary|larger/i.test(e.message)) {
				downloadItems([it]);
			}
			return;
		} finally {
			setLoading(false);
		}

		const readOnly = RO || !d.w;
		let wrapOn = store.get('wrap', false);
		const ov = document.createElement('div');
		ov.className = 'fvl-overlay fvl-ed-ov';
		ov.innerHTML =
			'<div class="fvl-ed" role="dialog" aria-modal="true">' +
			'<div class="fvl-ed-bar">' +
			'<span class="fvl-ed-ico">' + fileIcon(it) + '</span>' +
			'<div class="fvl-ed-title"><b>' + esc(it.name) + '</b><span>/' + esc(it.path) + '</span></div>' +
			'<span class="fvl-ed-state">' + (readOnly ? ui('lock') + 'Read-only' : 'Saved') + '</span>' +
			'<div class="fvl-ed-actions">' +
			'<button class="fvl-ib" data-ed="wrap" title="Toggle word wrap">' + ui('wrap') + '</button>' +
			'<button class="fvl-ib" data-ed="download" title="Download">' + ui('download') + '</button>' +
			(readOnly ? '' : '<button class="fvl-btn fvl-btn-primary" data-ed="save">' + ui('save') + '<span>Save</span><kbd>Ctrl S</kbd></button>') +
			'<button class="fvl-ib" data-ed="close" title="Close (Esc)">' + ui('x') + '</button>' +
			'</div></div>' +
			'<div class="fvl-ed-main"><textarea spellcheck="false"></textarea></div>' +
			'<div class="fvl-ed-foot"><span class="fvl-ed-lang">' + esc(typeName(it)) + '</span><span class="fvl-ed-pos">Ln 1, Col 1</span><span class="fvl-ed-size">' + fmtSize(d.size) + '</span><span>UTF-8</span></div>' +
			'</div>';
		shellEl().appendChild(ov);
		reveal(ov);

		const ta = ov.querySelector('textarea');
		ta.value = d.content;
		let cm = null;
		let mtime = d.mtime;
		let dirty = false;
		let saving = false;
		const state = ov.querySelector('.fvl-ed-state');
		const setState = (txt, cls) => {
			state.className = 'fvl-ed-state' + (cls ? ' ' + cls : '');
			state.textContent = txt;
		};
		const getVal = () => (cm ? cm.getValue() : ta.value);
		const markDirty = () => {
			if (!dirty && !readOnly) {
				dirty = true;
				setState('Unsaved changes', 'is-dirty');
			}
		};

		async function save(force) {
			if (saving || readOnly) {
				return;
			}
			saving = true;
			setState('Saving…', 'is-saving');
			try {
				const r = await api('save', { path: it.path, content: getVal(), mtime: force ? 0 : mtime, force: !!force });
				mtime = r.mtime;
				dirty = false;
				setState('Saved', 'is-saved');
				ov.querySelector('.fvl-ed-size').textContent = fmtSize(r.size);
				toast('Saved ' + it.name, 'success', 2000);
				const local = S.items.find((x) => x.path === it.path);
				if (local) {
					local.size = r.size;
					local.mtime = r.mtime;
					infoCache.delete(it.path);
				}
			} catch (e) {
				setState('Unsaved changes', 'is-dirty');
				if (e.code === 'conflict') {
					saving = false;
					const ok = await confirmBox('File changed on the server', '<p><b>' + esc(it.name) + '</b> was modified by someone else after you opened it.</p><p>Overwrite it with your version?</p>', { danger: true, ok: 'Overwrite', icon: 'info' });
					if (ok) {
						return save(true);
					}
				} else {
					toast(e.message, 'error');
				}
			} finally {
				saving = false;
			}
		}

		let popLayer = null;
		async function close() {
			if (dirty) {
				const ok = await confirmBox('Discard changes?', '<p>You have unsaved changes in <b>' + esc(it.name) + '</b>.</p>', { danger: true, ok: 'Discard', icon: 'info' });
				if (!ok) {
					return;
				}
			}
			if (popLayer) {
				popLayer();
			}
			window.removeEventListener('beforeunload', guard);
			ov.classList.remove('is-in');
			setTimeout(() => ov.remove(), 180);
			if (S.path === parentOf(it.path)) {
				renderList();
			}
		}
		const guard = (e) => {
			if (dirty) {
				e.preventDefault();
				e.returnValue = '';
			}
		};
		window.addEventListener('beforeunload', guard);
		popLayer = pushLayer(ov, close);

		if (C.codeEditor && window.wp && window.wp.codeEditor) {
			const settings = JSON.parse(JSON.stringify(C.codeEditor));
			settings.codemirror = Object.assign({}, settings.codemirror, {
				mode: modeFor(it.ext),
				lint: false,
				gutters: [],
				readOnly: readOnly,
				lineWrapping: wrapOn,
				lineNumbers: true,
				indentUnit: 4,
				tabSize: 4,
				indentWithTabs: true,
				styleActiveLine: true,
				matchBrackets: true,
			});
			try {
				cm = window.wp.codeEditor.initialize(ta, settings).codemirror;
				cm.setOption('extraKeys', Object.assign({}, cm.getOption('extraKeys') || {}, {
					'Ctrl-S': () => save(),
					'Cmd-S': () => save(),
				}));
				cm.on('change', markDirty);
				cm.on('cursorActivity', () => {
					const c = cm.getCursor();
					ov.querySelector('.fvl-ed-pos').textContent = 'Ln ' + (c.line + 1) + ', Col ' + (c.ch + 1);
				});
				cm.clearHistory();
				setTimeout(() => {
					cm.refresh();
					cm.focus();
				}, 60);
			} catch (e) {
				cm = null;
			}
		}
		if (!cm) {
			ta.classList.add('fvl-plain');
			ta.readOnly = readOnly;
			ta.style.whiteSpace = wrapOn ? 'pre-wrap' : 'pre';
			ta.addEventListener('input', markDirty);
			ta.addEventListener('keydown', (e) => {
				if (e.key === 'Tab') {
					e.preventDefault();
					document.execCommand('insertText', false, '\t');
				}
			});
			ta.focus();
		}

		ov.addEventListener('keydown', (e) => {
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
				e.preventDefault();
				save();
			}
		});
		ov.addEventListener('click', (e) => {
			const b = e.target.closest('[data-ed]');
			if (!b) {
				return;
			}
			const a = b.dataset.ed;
			if (a === 'save') {
				save();
			} else if (a === 'close') {
				close();
			} else if (a === 'download') {
				downloadItems([it]);
			} else if (a === 'wrap') {
				wrapOn = !wrapOn;
				store.set('wrap', wrapOn);
				b.classList.toggle('is-on', wrapOn);
				if (cm) {
					cm.setOption('lineWrapping', wrapOn);
				} else {
					ta.style.whiteSpace = wrapOn ? 'pre-wrap' : 'pre';
				}
			}
		});
		ov.querySelector('[data-ed="wrap"]').classList.toggle('is-on', wrapOn);
	}

	/* ================================================================== */
	/* Preview                                                             */
	/* ================================================================== */

	function openPreview(start) {
		const items = S.list.filter(isPreviewable);
		let idx = Math.max(0, items.indexOf(start));
		const ov = document.createElement('div');
		ov.className = 'fvl-overlay fvl-pv-ov';
		ov.innerHTML =
			'<div class="fvl-pv" role="dialog" aria-modal="true">' +
			'<div class="fvl-pv-bar"><span class="fvl-pv-ico"></span><div class="fvl-pv-title"><b></b><span></span></div>' +
			'<div class="fvl-pv-actions"><span class="fvl-pv-count"></span>' +
			'<button class="fvl-ib" data-pv="edit" title="Edit source" hidden>' + ui('code') + '</button>' +
			'<button class="fvl-ib" data-pv="download" title="Download">' + ui('download') + '</button>' +
			'<button class="fvl-ib" data-pv="close" title="Close (Esc)">' + ui('x') + '</button></div></div>' +
			'<div class="fvl-pv-stage"></div>' +
			(items.length > 1 ? '<button class="fvl-pv-nav is-prev" data-pv="prev" title="Previous (←)">' + ui('chevronLeft') + '</button><button class="fvl-pv-nav is-next" data-pv="next" title="Next (→)">' + ui('chevronRight') + '</button>' : '') +
			'</div>';
		shellEl().appendChild(ov);
		reveal(ov);

		const show = () => {
			const it = items[idx];
			const url = rawUrl(it.path);
			ov.querySelector('.fvl-pv-ico').innerHTML = fileIcon(it);
			ov.querySelector('.fvl-pv-title b').textContent = it.name;
			ov.querySelector('.fvl-pv-title span').textContent = fmtSize(it.size) + ' · ' + typeName(it) + ' · ' + relTime(it.mtime);
			ov.querySelector('.fvl-pv-count').textContent = items.length > 1 ? idx + 1 + ' / ' + items.length : '';
			ov.querySelector('[data-pv="edit"]').hidden = !(it.ext === 'svg');
			let h;
			if (IMG.has(it.ext)) {
				h = '<img src="' + esc(url) + '" alt="' + esc(it.name) + '" class="fvl-pv-img' + (it.ext === 'svg' || it.ext === 'png' || it.ext === 'gif' || it.ext === 'webp' ? ' is-alpha' : '') + '">';
			} else if (VID.has(it.ext)) {
				h = '<video src="' + esc(url) + '" controls autoplay playsinline></video>';
			} else if (AUD.has(it.ext)) {
				h = '<div class="fvl-pv-audio"><div class="fvl-pv-disc">' + fileIcon(it) + '</div><b>' + esc(it.name) + '</b><audio src="' + esc(url) + '" controls autoplay></audio></div>';
			} else {
				h = '<iframe src="' + esc(url) + '" title="' + esc(it.name) + '"></iframe>';
			}
			ov.querySelector('.fvl-pv-stage').innerHTML = h;
			const img = ov.querySelector('.fvl-pv-img');
			if (img) {
				img.addEventListener('load', () => {
					if (img.naturalWidth) {
						ov.querySelector('.fvl-pv-title span').textContent += ' · ' + img.naturalWidth + ' × ' + img.naturalHeight;
					}
				});
				img.addEventListener('click', () => img.classList.toggle('is-zoom'));
			}
			selectOnly(it.path);
		};
		const step = (n) => {
			if (items.length > 1) {
				idx = (idx + n + items.length) % items.length;
				show();
			}
		};
		let pop;
		const close = () => {
			pop();
			document.removeEventListener('keydown', keys, true);
			ov.classList.remove('is-in');
			setTimeout(() => ov.remove(), 180);
		};
		const keys = (e) => {
			if (layers[layers.length - 1] && layers[layers.length - 1].el !== ov) {
				return;
			}
			if (e.key === 'ArrowLeft') {
				e.preventDefault();
				step(-1);
			} else if (e.key === 'ArrowRight') {
				e.preventDefault();
				step(1);
			}
		};
		pop = pushLayer(ov, close);
		document.addEventListener('keydown', keys, true);
		ov.addEventListener('click', (e) => {
			const b = e.target.closest('[data-pv]');
			if (!b) {
				if (e.target.classList.contains('fvl-pv-stage')) {
					close();
				}
				return;
			}
			const a = b.dataset.pv;
			if (a === 'close') {
				close();
			} else if (a === 'prev') {
				step(-1);
			} else if (a === 'next') {
				step(1);
			} else if (a === 'download') {
				downloadItems([items[idx]]);
			} else if (a === 'edit') {
				const it = items[idx];
				close();
				openEditor(it);
			}
		});
		show();
	}

	/* ================================================================== */
	/* Shortcuts help                                                      */
	/* ================================================================== */

	function shortcuts() {
		const rows = [
			['Enter', 'Open selected item'],
			['Backspace', 'Go up one folder'],
			['Alt + ← / →', 'Back / forward'],
			['Arrow keys', 'Move selection'],
			['Shift + click', 'Select a range'],
			['Ctrl + click', 'Add to selection'],
			['Ctrl + A', 'Select all'],
			['Ctrl + C / X / V', 'Copy / cut / paste'],
			['Ctrl + D', 'Duplicate'],
			['F2', 'Rename'],
			['Delete', 'Delete selected'],
			['Alt + N', 'New folder'],
			['U', 'Upload files'],
			['/', 'Focus search'],
			['R', 'Refresh'],
			['V', 'Switch grid / list'],
			['H', 'Show / hide hidden files'],
			['I', 'Toggle details panel'],
			['Ctrl + S', 'Save (in editor)'],
			['Esc', 'Close dialog / clear selection'],
		];
		modal({
			title: 'Keyboard shortcuts',
			icon: 'keyboard',
			cls: 'fvl-keys',
			body: '<div class="fvl-keys-grid">' + rows.map((r) => '<div><kbd>' + r[0].split(' + ').map(esc).join('</kbd> + <kbd>') + '</kbd></div><span>' + esc(r[1]) + '</span>').join('') + '</div>',
			buttons: [{ label: 'Got it', primary: true }],
		});
	}

	/* ================================================================== */
	/* Context menu & dropdowns                                            */
	/* ================================================================== */

	let ctxEl = null;

	function closeCtx() {
		if (ctxEl) {
			ctxEl.remove();
			ctxEl = null;
		}
	}

	function menu(x, y, entries, anchor) {
		closeCtx();
		const m = document.createElement('div');
		m.className = 'fvl-ctx';
		m.setAttribute('role', 'menu');
		m.innerHTML = entries
			.filter(Boolean)
			.map((e, i) =>
				e === '-'
					? '<div class="fvl-ctx-sep"></div>'
					: e.title
					? '<div class="fvl-ctx-title">' + esc(e.title) + '</div>'
					: '<button role="menuitem" data-ci="' + i + '"' + (e.disabled ? ' disabled' : '') + ' class="' + (e.danger ? 'is-danger' : '') + (e.checked ? ' is-checked' : '') + '">' + (e.checked ? ui('check') : e.icon ? ui(e.icon) : '<span class="fvl-i"></span>') + '<span>' + esc(e.label) + '</span>' + (e.kbd ? '<kbd>' + esc(e.kbd) + '</kbd>' : '') + '</button>'
			)
			.join('');
		shellEl().appendChild(m);
		const list = entries.filter(Boolean);
		m.addEventListener('click', (ev) => {
			const b = ev.target.closest('[data-ci]');
			if (!b) {
				return;
			}
			const e = list[+b.dataset.ci];
			closeCtx();
			if (e && e.fn) {
				e.fn();
			}
		});
		const r = m.getBoundingClientRect();
		const W = window.innerWidth;
		const H = window.innerHeight;
		if (anchor) {
			const a = anchor.getBoundingClientRect();
			x = Math.min(a.right - r.width, W - r.width - 8);
			x = Math.max(8, x);
			y = a.bottom + 6;
		}
		if (x + r.width > W - 8) {
			x = W - r.width - 8;
		}
		if (y + r.height > H - 8) {
			y = Math.max(8, H - r.height - 8);
		}
		m.style.left = x + 'px';
		m.style.top = y + 'px';
		reveal(m);
		ctxEl = m;
	}

	function itemMenu(e) {
		const items = selected();
		const one = items.length === 1 ? items[0] : null;
		const W = !RO;
		const entries = [];
		if (one) {
			if (one.dir) {
				entries.push({ label: 'Open', icon: 'folderOpen', kbd: 'Enter', fn: () => openItem(one) });
			} else {
				if (isPreviewable(one)) {
					entries.push({ label: 'Preview', icon: 'eye', kbd: 'Enter', fn: () => openPreview(one) });
				}
				if (isEditable(one)) {
					entries.push({ label: W ? 'Edit' : 'View source', icon: 'code', kbd: isPreviewable(one) ? '' : 'Enter', fn: () => openEditor(one) });
				}
				if (isZip(one) && W) {
					entries.push({ label: 'Extract…', icon: 'unarchive', fn: () => extract(one) });
				}
			}
			entries.push('-');
		}
		entries.push({ label: items.length > 1 || (one && one.dir) ? 'Download as ZIP' : 'Download', icon: 'download', fn: () => downloadItems(items) });
		if (W) {
			entries.push({ label: 'Copy', icon: 'copy', kbd: 'Ctrl+C', fn: () => toClipboard(items, 'copy') });
			entries.push({ label: 'Cut', icon: 'scissors', kbd: 'Ctrl+X', fn: () => toClipboard(items, 'move') });
			if (one && one.dir && S.clip) {
				entries.push({ label: 'Paste into folder', icon: 'clipboard', fn: () => paste(one.path) });
			}
			entries.push({ label: 'Duplicate', icon: 'copy', kbd: 'Ctrl+D', fn: () => duplicate(items) });
			if (one) {
				entries.push({ label: 'Rename', icon: 'pencil', kbd: 'F2', fn: () => renameItem(one) });
			}
			entries.push('-');
			entries.push({ label: 'Compress to ZIP', icon: 'archive', fn: () => compress(items) });
			if (one) {
				entries.push({ label: 'Permissions…', icon: 'lock', fn: () => chmodItem(one) });
			}
		}
		if (one) {
			entries.push('-');
			entries.push({ label: 'Copy server path', icon: 'link', fn: () => copyText(absPath(one.path), 'Path') });
			entries.push({
				label: 'Copy public URL',
				icon: 'globe',
				fn: async () => {
					try {
						const info = infoCache.get(one.path) || (await api('info', { path: one.path }));
						if (info.url) {
							copyText(info.url, 'URL');
						} else {
							toast('This item is outside the public website folder.', 'info');
						}
					} catch (er) {
						toast(er.message, 'error');
					}
				},
			});
			if (S.search) {
				entries.push({ label: 'Show in folder', icon: 'folderOpen', fn: () => go(parentOf(one.path), { select: [one.path] }) });
			}
		}
		if (W) {
			entries.push('-');
			entries.push({ label: items.length > 1 ? 'Delete ' + items.length + ' items' : 'Delete', icon: 'trash', kbd: 'Del', danger: true, fn: () => deleteItems(items) });
		}
		menu(e.clientX, e.clientY, entries);
	}

	function bgMenu(e) {
		const W = !RO && S.writable && !S.search;
		menu(e.clientX, e.clientY, [
			W && { label: 'New folder', icon: 'folderPlus', kbd: 'Alt+N', fn: newFolder },
			W && { label: 'New file', icon: 'filePlus', fn: newFile },
			W && { label: 'Upload files', icon: 'upload', kbd: 'U', fn: () => $('#fvl-files').click() },
			W && { label: 'Upload folder', icon: 'folderUpload', fn: () => $('#fvl-folder').click() },
			W && S.clip && { label: 'Paste ' + S.clip.paths.length + ' item(s)', icon: 'clipboard', kbd: 'Ctrl+V', fn: () => paste() },
			W && '-',
			{ label: 'Refresh', icon: 'refresh', kbd: 'R', fn: () => refresh() },
			{ label: 'Select all', icon: 'selectAll', kbd: 'Ctrl+A', fn: selectAll },
			'-',
			{ label: 'Grid view', icon: 'grid', checked: S.view === 'grid', fn: () => setView('grid') },
			{ label: 'List view', icon: 'list', checked: S.view === 'list', fn: () => setView('list') },
			{ label: 'Show hidden files', icon: 'eye', checked: S.hidden, fn: toggleHidden },
			'-',
			{ label: 'Copy folder path', icon: 'link', fn: () => copyText(absPath(S.path), 'Path') },
			{ label: 'Download folder as ZIP', icon: 'download', fn: () => downloadItems([{ path: S.path, dir: true, name: baseOf(S.path) }]) },
		]);
	}

	function setView(v) {
		S.view = v;
		store.set('view', v);
		renderToolbar();
		renderList();
	}

	function toggleHidden() {
		S.hidden = !S.hidden;
		store.set('hidden', S.hidden);
		treeLoaded.clear();
		$('.fvl-tree').innerHTML = treeNode(C.site || C.rootName, '', 0, false);
		renderToolbar();
		refresh();
		toast(S.hidden ? 'Hidden files are now visible' : 'Hidden files are now hidden', 'info', 2000);
	}

	function selectAll() {
		S.sel = new Set(S.list.map((i) => i.path));
		syncSel();
	}

	function setSort(k, d) {
		S.sort = { k: k, d: d || (S.sort.k === k ? -S.sort.d : 1) };
		store.set('sort', S.sort);
		renderList();
	}

	/* ================================================================== */
	/* Uploads                                                             */
	/* ================================================================== */

	const U = { q: [], active: 0, max: 3, seq: 0, done: 0, failed: 0, dests: new Set() };

	function enqueue(files, dest) {
		if (RO) {
			return;
		}
		if (!files.length) {
			return;
		}
		files.forEach((f) => {
			U.q.push({ id: ++U.seq, file: f.file, rel: f.rel || '', dest: dest, status: 'queued', pct: 0, err: '' });
		});
		U.dests.add(dest);
		const panel = $('.fvl-uploads');
		panel.hidden = false;
		panel.classList.remove('is-min');
		renderUploads();
		pump();
	}

	function pump() {
		while (U.active < U.max) {
			const next = U.q.find((u) => u.status === 'queued');
			if (!next) {
				break;
			}
			startUpload(next);
		}
		if (!U.active && !U.q.some((u) => u.status === 'queued')) {
			finishUploads();
		}
	}

	function startUpload(u) {
		if (u.file.size > C.maxUpload) {
			u.status = 'error';
			u.err = 'Larger than the server limit (' + fmtSize(C.maxUpload) + ')';
			U.failed++;
			renderUploads();
			return;
		}
		U.active++;
		u.status = 'uploading';
		const fd = new FormData();
		fd.append('action', 'fivelle_fe_upload');
		fd.append('nonce', C.nonce);
		fd.append('path', u.dest);
		fd.append('relpath', u.rel);
		fd.append('file', u.file, u.file.name);
		const xhr = new XMLHttpRequest();
		xhr.open('POST', C.ajax);
		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable) {
				u.pct = Math.round((e.loaded / e.total) * 100);
				updateUploadRow(u);
			}
		};
		const end = (ok, msg) => {
			U.active--;
			u.status = ok ? 'done' : 'error';
			u.err = msg || '';
			u.pct = ok ? 100 : u.pct;
			if (ok) {
				U.done++;
			} else {
				U.failed++;
			}
			renderUploads();
			pump();
		};
		xhr.onload = () => {
			let j = null;
			try {
				j = JSON.parse(xhr.responseText);
			} catch (e) {
				/* not json */
			}
			if (j && j.success) {
				end(true);
			} else {
				end(false, (j && j.data && j.data.message) || (xhr.status === 413 ? 'File too large for the server' : 'Upload failed (HTTP ' + xhr.status + ')'));
			}
		};
		xhr.onerror = () => end(false, 'Network error');
		xhr.send(fd);
		renderUploads();
	}

	function updateUploadRow(u) {
		const r = $('[data-up="' + u.id + '"]');
		if (r) {
			r.querySelector('.fvl-up-bar i').style.width = u.pct + '%';
			r.querySelector('.fvl-up-st').textContent = u.pct + '%';
		}
		const total = U.q.length;
		const pct = Math.round(U.q.reduce((s, x) => s + (x.status === 'done' || x.status === 'error' ? 100 : x.pct), 0) / total);
		const ob = $('.fvl-up-total i');
		if (ob) {
			ob.style.width = pct + '%';
		}
	}

	function renderUploads() {
		const panel = $('.fvl-uploads');
		const total = U.q.length;
		const finished = U.done + U.failed;
		const busy = finished < total;
		const head = busy ? 'Uploading ' + Math.min(finished + 1, total) + ' of ' + total : U.failed ? U.done + ' uploaded, ' + U.failed + ' failed' : total + ' upload' + (total === 1 ? '' : 's') + ' complete';
		panel.innerHTML =
			'<div class="fvl-up-head"><span class="fvl-up-ic ' + (busy ? 'is-busy' : U.failed ? 'is-err' : 'is-ok') + '">' + ui(busy ? 'upload' : U.failed ? 'info' : 'check') + '</span><b>' + head + '</b>' +
			'<button class="fvl-ib" data-a="up-min" title="Minimise">' + ui('chevronDown') + '</button>' +
			'<button class="fvl-ib" data-a="up-close" title="Close"' + (busy ? ' disabled' : '') + '>' + ui('x') + '</button></div>' +
			'<div class="fvl-up-total"><i style="width:' + Math.round((finished / Math.max(1, total)) * 100) + '%"></i></div>' +
			'<div class="fvl-up-list">' +
			U.q
				.slice()
				.reverse()
				.slice(0, 200)
				.map(
					(u) =>
						'<div class="fvl-up-row is-' + u.status + '" data-up="' + u.id + '"><span class="fvl-up-fi">' + fileIcon({ ext: u.file.name.lastIndexOf('.') > 0 ? u.file.name.split('.').pop().toLowerCase() : '' }) + '</span>' +
						'<div class="fvl-up-info"><div class="fvl-up-name" title="' + esc(u.rel || u.file.name) + '">' + esc(u.rel || u.file.name) + '</div>' +
						'<div class="fvl-up-bar"><i style="width:' + u.pct + '%"></i></div>' +
						'<div class="fvl-up-sub">' + (u.status === 'error' ? '<span class="fvl-warn">' + esc(u.err) + '</span>' : fmtSize(u.file.size) + ' → /' + esc(u.dest)) + '</div></div>' +
						'<span class="fvl-up-st">' + (u.status === 'done' ? ui('check') : u.status === 'error' ? ui('x') : u.status === 'queued' ? 'Queued' : u.pct + '%') + '</span></div>'
				)
				.join('') +
			'</div>';
	}

	function finishUploads() {
		if (!U.q.length) {
			return;
		}
		const affected = U.dests;
		U.dests = new Set();
		if ([...affected].some((d) => d === S.path || d.indexOf(S.path ? S.path + '/' : '') === 0)) {
			refresh();
		}
		treeRefresh([...affected]);
		if (U.done) {
			toast(U.done + ' file' + (U.done === 1 ? '' : 's') + ' uploaded' + (U.failed ? ', ' + U.failed + ' failed' : ''), U.failed ? 'warn' : 'success');
		}
		if (!U.failed) {
			setTimeout(() => {
				if (!U.q.some((u) => u.status === 'queued' || u.status === 'uploading')) {
					$('.fvl-uploads').hidden = true;
					U.q = [];
					U.done = U.failed = 0;
				}
			}, 4000);
		}
	}

	async function filesFromDrop(dt) {
		const entries = Array.from(dt.items || [])
			.filter((i) => i.kind === 'file')
			.map((i) => (i.webkitGetAsEntry ? i.webkitGetAsEntry() : null));
		const plain = Array.from(dt.files || []);
		if (!entries.length || entries.some((e) => !e)) {
			return plain.map((f) => ({ file: f, rel: '' }));
		}
		const out = [];
		const readAll = (reader) =>
			new Promise((res, rej) => {
				const acc = [];
				const next = () =>
					reader.readEntries((batch) => {
						if (!batch.length) {
							res(acc);
						} else {
							acc.push.apply(acc, batch);
							next();
						}
					}, rej);
				next();
			});
		async function walk(entry, prefix) {
			if (entry.isFile) {
				const f = await new Promise((res, rej) => entry.file(res, rej));
				out.push({ file: f, rel: prefix ? prefix + f.name : '' });
			} else if (entry.isDirectory) {
				const kids = await readAll(entry.createReader());
				for (const k of kids) {
					await walk(k, prefix + entry.name + '/');
				}
			}
		}
		for (const e of entries) {
			await walk(e, '');
		}
		return out;
	}

	/* ================================================================== */
	/* Drag & drop                                                         */
	/* ================================================================== */

	const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).indexOf('Files') > -1;

	function dropTargetOf(e) {
		const t = e.target.closest('[data-drop]');
		if (t && root.contains(t)) {
			return { el: t, path: t.dataset.path };
		}
		if (e.target.closest('.fvl-content') && !S.search) {
			return { el: null, path: S.path, bg: true };
		}
		return null;
	}

	function clearDropUI() {
		$$('.is-drop').forEach((el) => el.classList.remove('is-drop'));
		const c = $('.fvl-content');
		if (c) {
			c.classList.remove('is-dropping');
		}
	}

	function bindDnD() {
		root.addEventListener('dragstart', (e) => {
			const el = e.target.closest('.fvl-item[data-i], .fvl-row[data-i]');
			if (!el || RO) {
				return;
			}
			const it = S.list[+el.dataset.i];
			if (!S.sel.has(it.path)) {
				selectOnly(it.path);
			}
			S.drag = [...S.sel];
			e.dataTransfer.effectAllowed = 'copyMove';
			e.dataTransfer.setData('text/plain', S.drag.map((p) => '/' + p).join('\n'));
			const ghost = document.createElement('div');
			ghost.className = 'fvl-ghost';
			ghost.innerHTML = icon(it) + '<span>' + (S.drag.length > 1 ? S.drag.length + ' items' : esc(it.name)) + '</span>';
			root.appendChild(ghost);
			e.dataTransfer.setDragImage(ghost, 20, 20);
			setTimeout(() => ghost.remove(), 0);
		});
		root.addEventListener('dragend', () => {
			S.drag = null;
			clearDropUI();
		});
		root.addEventListener('dragover', (e) => {
			const files = hasFiles(e) && !S.drag;
			if (!files && !S.drag) {
				return;
			}
			if (RO) {
				return;
			}
			const t = dropTargetOf(e);
			$$('.is-drop').forEach((el) => {
				if (!t || el !== t.el) {
					el.classList.remove('is-drop');
				}
			});
			if (!t) {
				$('.fvl-content').classList.remove('is-dropping');
				return;
			}
			if (S.drag) {
				const invalid = t.bg || S.drag.indexOf(t.path) > -1 || S.drag.some((p) => t.path.indexOf(p + '/') === 0) || S.drag.every((p) => parentOf(p) === t.path);
				if (invalid) {
					e.dataTransfer.dropEffect = 'none';
					return;
				}
				e.preventDefault();
				e.dataTransfer.dropEffect = e.ctrlKey || e.altKey ? 'copy' : 'move';
				t.el.classList.add('is-drop');
				return;
			}
			e.preventDefault();
			e.dataTransfer.dropEffect = 'copy';
			if (t.el) {
				t.el.classList.add('is-drop');
			}
			const c = $('.fvl-content');
			c.classList.add('is-dropping');
			$('.fvl-drop-to').textContent = 'into /' + t.path;
		});
		root.addEventListener('dragleave', (e) => {
			if (!e.relatedTarget || !root.contains(e.relatedTarget)) {
				clearDropUI();
			}
		});
		root.addEventListener('drop', (e) => {
			const t = dropTargetOf(e);
			if (!t) {
				return;
			}
			e.preventDefault();
			clearDropUI();
			if (RO) {
				return;
			}
			if (S.drag) {
				const paths = S.drag;
				S.drag = null;
				paste(t.path, paths, e.ctrlKey || e.altKey ? 'copy' : 'move');
				return;
			}
			if (hasFiles(e)) {
				filesFromDrop(e.dataTransfer).then((files) => enqueue(files, t.path));
			}
		});
		// Stop the browser from opening files dropped outside the drop zones.
		window.addEventListener('dragover', (e) => {
			if (hasFiles(e)) {
				e.preventDefault();
			}
		});
		window.addEventListener('drop', (e) => {
			if (hasFiles(e) && !root.contains(e.target)) {
				e.preventDefault();
			}
		});
	}

	/* ================================================================== */
	/* Storage card                                                        */
	/* ================================================================== */

	async function loadStats() {
		try {
			const s = await api('stats');
			const el = $('.fvl-storage');
			let h = '<div class="fvl-st-card">';
			if (s.disk && s.disk.total) {
				const used = s.disk.total - s.disk.free;
				const pct = Math.round((used / s.disk.total) * 100);
				h += '<div class="fvl-st-row">' + ui('hardDrive') + '<b>Storage</b><span>' + pct + '%</span></div>' +
					'<div class="fvl-meter' + (pct > 90 ? ' is-hot' : pct > 75 ? ' is-warm' : '') + '"><i style="width:' + pct + '%"></i></div>' +
					'<div class="fvl-st-sub">' + fmtSize(used) + ' of ' + fmtSize(s.disk.total) + ' used · ' + fmtSize(s.disk.free) + ' free</div>';
			}
			h += '<div class="fvl-st-tags"><span title="PHP version">PHP ' + esc(s.php) + '</span><span title="WordPress version">WP ' + esc(s.wp) + '</span><span title="Maximum upload size">' + ui('upload') + fmtSize(s.max_upload) + '</span>' + (s.zip ? '' : '<span class="fvl-warn" title="ZIP features need the PHP Zip extension">No ZIP</span>') + '</div></div>';
			el.innerHTML = h;
		} catch (e) {
			/* optional */
		}
	}

	/* ================================================================== */
	/* Action map (data-a="...")                                           */
	/* ================================================================== */

	const A = {
		go: (el) => {
			go(el.dataset.path);
			shellEl().classList.remove('side-open');
		},
		'tree-toggle': (el) => treeToggle(el.dataset.path),
		back: () => {
			if (S.back.length) {
				const p = S.back.pop();
				S.fwd.push(S.path);
				go(p, { push: false });
			}
		},
		forward: () => {
			if (S.fwd.length) {
				const p = S.fwd.pop();
				S.back.push(S.path);
				go(p, { push: false });
			}
		},
		up: () => {
			if (S.path) {
				const from = S.path;
				go(parentOf(S.path), { select: [from] });
			}
		},
		refresh: () => {
			treeRefresh();
			refresh();
		},
		view: (el) => setView(el.dataset.v),
		sort: (el) => setSort(el.dataset.k),
		hidden: toggleHidden,
		details: () => {
			S.details = !S.details;
			store.set('details', S.details);
			shellEl().classList.toggle('no-details', !S.details);
			renderToolbar();
			renderDetails();
		},
		theme: (el) => {
			S.theme = S.theme === 'dark' ? 'light' : 'dark';
			store.set('theme', S.theme);
			root.dataset.theme = S.theme;
			el.innerHTML = ui(S.theme === 'dark' ? 'sun' : 'moon');
		},
		side: () => shellEl().classList.toggle('side-open'),
		shortcuts: shortcuts,
		'new-menu': (el) =>
			menu(0, 0, [
				{ label: 'New folder', icon: 'folderPlus', kbd: 'Alt+N', fn: newFolder },
				{ label: 'New file', icon: 'filePlus', fn: newFile },
			], el),
		'upload-menu': (el) =>
			menu(0, 0, [
				{ label: 'Upload files', icon: 'upload', kbd: 'U', fn: () => $('#fvl-files').click() },
				{ label: 'Upload folder', icon: 'folderUpload', fn: () => $('#fvl-folder').click() },
				'-',
				{ title: 'Max ' + fmtSize(C.maxUpload) + ' per file · or drag & drop' },
			], el),
		'sort-menu': (el) =>
			menu(0, 0, [
				{ title: 'Sort by' },
				{ label: 'Name', checked: S.sort.k === 'name', fn: () => setSort('name', S.sort.d) },
				{ label: 'Size', checked: S.sort.k === 'size', fn: () => setSort('size', S.sort.d) },
				{ label: 'Date modified', checked: S.sort.k === 'mtime', fn: () => setSort('mtime', S.sort.d) },
				{ label: 'Type', checked: S.sort.k === 'type', fn: () => setSort('type', S.sort.d) },
				'-',
				{ label: 'Ascending', icon: 'arrowUp', checked: S.sort.d > 0, fn: () => setSort(S.sort.k, 1) },
				{ label: 'Descending', icon: 'chevronDown', checked: S.sort.d < 0, fn: () => setSort(S.sort.k, -1) },
			], el),
		upload: () => $('#fvl-files').click(),
		'new-folder': newFolder,
		'new-file': newFile,
		paste: () => paste(),
		'clear-clip': () => {
			S.clip = null;
			renderToolbar();
			renderList();
		},
		'clear-sel': () => selectOnly(null),
		'clear-search': clearSearch,
		'deep-search': () => runSearch($('#fvl-q').value),
		open: (el) => openItem(targetItems(el)[0]),
		download: (el) => downloadItems(targetItems(el)),
		copy: (el) => toClipboard(targetItems(el), 'copy'),
		cut: (el) => toClipboard(targetItems(el), 'move'),
		rename: (el) => renameItem(targetItems(el)[0]),
		duplicate: (el) => duplicate(targetItems(el)),
		compress: (el) => compress(targetItems(el)),
		extract: (el) => extract(targetItems(el)[0]),
		chmod: (el) => chmodItem(targetItems(el)[0]),
		delete: (el) => deleteItems(targetItems(el)),
		dirsize: (el) => dirSize(el.dataset.path, el),
		'copy-path': (el) => copyText(absPath(el.dataset.path), 'Path'),
		'copy-url': (el) => copyText(el.dataset.url, 'URL'),
		'up-min': () => $('.fvl-uploads').classList.toggle('is-min'),
		'up-close': () => {
			$('.fvl-uploads').hidden = true;
			U.q = [];
			U.done = U.failed = 0;
		},
	};

	/* ================================================================== */
	/* Events                                                              */
	/* ================================================================== */

	function bind() {
		root.addEventListener('click', (e) => {
			const a = e.target.closest('[data-a]');
			if (a && root.contains(a) && !a.disabled) {
				const fn = A[a.dataset.a];
				if (fn) {
					e.preventDefault();
					e.stopPropagation();
					fn(a, e);
					return;
				}
			}
			const item = e.target.closest('.fvl-item[data-i], .fvl-row[data-i]');
			if (item) {
				onItemClick(item, e);
				return;
			}
			if (e.target.closest('.fvl-content') && !e.target.closest('.fvl-lhead, .fvl-empty')) {
				if (S.sel.size) {
					selectOnly(null);
				}
			}
		});

		root.addEventListener('dblclick', (e) => {
			const item = e.target.closest('.fvl-item[data-i], .fvl-row[data-i]');
			if (item) {
				openItem(S.list[+item.dataset.i]);
			}
		});

		root.addEventListener('contextmenu', (e) => {
			if (e.target.closest('input, textarea, .fvl-overlay, .CodeMirror')) {
				return;
			}
			const item = e.target.closest('.fvl-item[data-i], .fvl-row[data-i]');
			if (item) {
				e.preventDefault();
				const it = S.list[+item.dataset.i];
				if (!S.sel.has(it.path)) {
					S.sel = new Set([it.path]);
					S.anchor = it.path;
					S.focus = +item.dataset.i;
					syncSel();
				}
				itemMenu(e);
				return;
			}
			if (e.target.closest('.fvl-content')) {
				e.preventDefault();
				bgMenu(e);
			}
		});

		root.addEventListener('error', (e) => {
			if (e.target && e.target.classList && e.target.classList.contains('fvl-img')) {
				e.target.remove();
			}
		}, true);
		root.addEventListener('load', (e) => {
			if (e.target && e.target.classList && e.target.classList.contains('fvl-img')) {
				e.target.classList.add('is-loaded');
			}
		}, true);

		document.addEventListener('mousedown', (e) => {
			if (ctxEl && !ctxEl.contains(e.target)) {
				closeCtx();
			}
		});
		window.addEventListener('resize', () => {
			closeCtx();
			fit();
		});
		window.addEventListener('blur', closeCtx);
		$('.fvl-content').addEventListener('scroll', closeCtx, { passive: true });

		const q = $('#fvl-q');
		q.addEventListener(
			'input',
			debounce(() => {
				if (S.search) {
					S.search = null;
				}
				S.filter = q.value.trim();
				renderList();
			}, 120)
		);
		q.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				runSearch(q.value);
			} else if (e.key === 'Escape') {
				e.preventDefault();
				clearSearch();
				q.blur();
			}
		});

		$('#fvl-files').addEventListener('change', (e) => {
			enqueue(Array.from(e.target.files).map((f) => ({ file: f, rel: '' })), S.path);
			e.target.value = '';
		});
		$('#fvl-folder').addEventListener('change', (e) => {
			enqueue(Array.from(e.target.files).map((f) => ({ file: f, rel: f.webkitRelativePath || '' })), S.path);
			e.target.value = '';
		});

		document.addEventListener('keydown', onKey);
		window.addEventListener('hashchange', () => {
			const p = decodeURIComponent(location.hash.slice(1));
			if (p !== S.path) {
				go(p);
			}
		});
		bindDnD();
	}

	function gridCols() {
		const items = $$('.fvl-list.is-grid .fvl-item[data-i]');
		if (items.length < 2) {
			return 1;
		}
		const top = items[0].offsetTop;
		let n = 0;
		while (n < items.length && items[n].offsetTop === top) {
			n++;
		}
		return n;
	}

	function moveFocus(delta, extend) {
		if (!S.list.length) {
			return;
		}
		let i = S.focus < 0 ? (delta > 0 ? 0 : S.list.length - 1) : Math.min(S.list.length - 1, Math.max(0, S.focus + delta));
		S.focus = i;
		const it = S.list[i];
		if (extend && S.anchor) {
			const a = S.list.findIndex((x) => x.path === S.anchor);
			const [from, to] = a < i ? [a, i] : [i, a];
			S.sel = new Set(S.list.slice(from, to + 1).map((x) => x.path));
		} else {
			S.sel = new Set([it.path]);
			S.anchor = it.path;
		}
		syncSel();
		const el = $('[data-i="' + i + '"]', $('.fvl-list'));
		if (el) {
			el.scrollIntoView({ block: 'nearest' });
		}
	}

	function onKey(e) {
		if (layers.length) {
			if (e.key === 'Escape') {
				e.preventDefault();
				layers[layers.length - 1].close();
			}
			return;
		}
		if (ctxEl && e.key === 'Escape') {
			closeCtx();
			return;
		}
		const t = e.target;
		if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) {
			return;
		}
		// Ignore keys aimed at the WP admin menu/bar.
		if (t && t.closest && t.closest('#adminmenuwrap, #wpadminbar')) {
			return;
		}
		const mod = e.ctrlKey || e.metaKey;
		const k = e.key;
		const items = selected();
		const W = !RO;

		if (mod && k.toLowerCase() === 'a') {
			e.preventDefault();
			selectAll();
		} else if (mod && k.toLowerCase() === 'c' && W && items.length) {
			e.preventDefault();
			toClipboard(items, 'copy');
		} else if (mod && k.toLowerCase() === 'x' && W && items.length) {
			e.preventDefault();
			toClipboard(items, 'move');
		} else if (mod && k.toLowerCase() === 'v' && W && S.clip && !S.search) {
			e.preventDefault();
			paste();
		} else if (mod && k.toLowerCase() === 'd' && W && items.length) {
			e.preventDefault();
			duplicate(items);
		} else if (mod) {
			return;
		} else if (e.altKey && k === 'ArrowLeft') {
			e.preventDefault();
			A.back();
		} else if (e.altKey && k === 'ArrowRight') {
			e.preventDefault();
			A.forward();
		} else if ((e.altKey && k === 'ArrowUp') || k === 'Backspace') {
			e.preventDefault();
			A.up();
		} else if (e.altKey && (k === 'n' || k === 'N')) {
			e.preventDefault();
			if (W && S.writable) {
				newFolder();
			}
		} else if (e.altKey) {
			return;
		} else if (k === 'Delete' && W && items.length) {
			e.preventDefault();
			deleteItems(items);
		} else if (k === 'F2' && W && items.length === 1) {
			e.preventDefault();
			renameItem(items[0]);
		} else if (k === 'Enter' && items.length === 1) {
			e.preventDefault();
			openItem(items[0]);
		} else if (k === 'Escape') {
			if (S.search || S.filter) {
				clearSearch();
			} else {
				selectOnly(null);
			}
		} else if (k === 'ArrowRight' || k === 'ArrowLeft') {
			e.preventDefault();
			moveFocus(k === 'ArrowRight' ? 1 : -1, e.shiftKey);
		} else if (k === 'ArrowDown' || k === 'ArrowUp') {
			e.preventDefault();
			const step = S.view === 'grid' ? gridCols() : 1;
			moveFocus(k === 'ArrowDown' ? step : -step, e.shiftKey);
		} else if (k === 'Home' || k === 'End') {
			e.preventDefault();
			S.focus = -1;
			moveFocus(k === 'Home' ? 1 : -1, false);
		} else if (k === '/') {
			e.preventDefault();
			$('#fvl-q').focus();
		} else if (k === '?') {
			shortcuts();
		} else if (k === 'r' || k === 'R') {
			A.refresh();
		} else if (k === 'v' || k === 'V') {
			setView(S.view === 'grid' ? 'list' : 'grid');
		} else if (k === 'h' || k === 'H') {
			toggleHidden();
		} else if (k === 'i' || k === 'I') {
			A.details();
		} else if ((k === 'u' || k === 'U') && W && S.writable) {
			$('#fvl-files').click();
		}
	}

	/* ================================================================== */
	/* Boot                                                                */
	/* ================================================================== */

	function boot() {
		if (C.error) {
			root.dataset.theme = S.theme;
			root.innerHTML =
				DEFS +
				'<div class="fvl-fatal">' + LOGO + '<h2>Easy File Manager can’t start</h2><p>' + esc(C.error) + '</p><a class="fvl-btn fvl-btn-primary" href="' + esc(C.settingsUrl) + '">Open settings</a></div>';
			return;
		}
		shell();
		renderQuick();
		$('.fvl-tree').innerHTML = treeNode(C.site || C.rootName, '', 0, false);
		renderToolbar();
		bind();
		fit();
		setTimeout(fit, 300);
		let start = '';
		try {
			start = decodeURIComponent(location.hash.slice(1));
		} catch (e) {
			start = '';
		}
		go(start, { push: false });
		loadStats();
	}

	boot();
})();
