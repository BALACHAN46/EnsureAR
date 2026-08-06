// Custom mouse cursor
(function() {
	var e = document.getElementById("bnz-pointer");

	// Only run cursor effects if the pointer element exists
	if (!e) return;

	document.getElementsByTagName("body")[0].addEventListener("mousemove", function(n) {
		e.style.left = n.clientX + "px";
		e.style.top = n.clientY + "px";
	});

	$(document).mousemove(function(ev) {

		$(".swiper-button-prev, .swiper-button-next, input.button, a, .btn, button, #mode_switcher")
		.on("mouseenter", function() {
			$('.bnz-pointer').addClass("bnz-large");
		})
		.on("mouseleave", function() {
			$('.bnz-pointer').removeClass("bnz-large");
		});

		$(".main_menu > li > a")
		.on("mouseenter", function() {
			$('.bnz-pointer').removeClass("bnz-large");
		});

		$(".swiper-pagination-bullet, .filters-button-group button, .form-control")
		.on("mouseenter", function() {
			$('.bnz-pointer').addClass("bnz-small");
		})
		.on("mouseleave", function() {
			$('.bnz-pointer').removeClass("bnz-small");
		});

		$(".swiper-slide")
		.on("mouseenter", function() {
			$('.bnz-pointer').addClass("bnz-drag");
		})
		.on("mouseleave", function() {
			$('.bnz-pointer').removeClass("bnz-drag");
		});

		$(".bnz-pointer-none")
		.on("mouseenter", function() {
			$('.bnz-pointer').addClass("bnz-none");
		})
		.on("mouseleave", function() {
			$('.bnz-pointer').removeClass("bnz-none");
		});
	});
})();