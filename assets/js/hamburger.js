var button = document.querySelector('.kodin-hamburger');
var sideNav = document.querySelector('.kodin-side-nav');

var toggle = function (event) {
  event.preventDefault();
  sideNav.classList.toggle('kodin-side-nav--open');
};

button.addEventListener('click', toggle);

console.log('Hamburger');
