/* Easy File Manager: Settings & Activity Log screens. */
(function () {
	'use strict';
	document.addEventListener('submit', function (e) {
		var form = e.target;
		var msg = form && form.getAttribute && form.getAttribute('data-fvl-confirm');
		if (msg && !window.confirm(msg)) {
			e.preventDefault();
		}
	});
})();
