var body = document.getElementsByTagName('body')[0];
var button = document.querySelector('.kodin-hamburger');
var sideNav = document.querySelector('.kodin-side-nav');

var SIDE_NAV_OPEN_CLASS_NAME = 'kodin-side-nav--open';

var toggle = function (event) {
  event.stopPropagation();
  sideNav.classList.toggle(SIDE_NAV_OPEN_CLASS_NAME);
};

var close = function (event) {
  if (event.target.closest('.kodin-side-nav')) return;

  sideNav.classList.remove(SIDE_NAV_OPEN_CLASS_NAME);
};

button.addEventListener('click', toggle);
body.addEventListener('click', close);
body.addEventListener('touchstart', close);
