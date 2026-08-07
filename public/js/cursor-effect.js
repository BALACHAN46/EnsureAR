window.initCursor = function() {
	var e = document.getElementById("bnz-pointer");

	// Only run cursor effects if the pointer element exists
	if (!e) return;

	document.getElementsByTagName("body")[0].addEventListener("mousemove", function(n) {
		e.style.left = n.clientX + "px";
		e.style.top = n.clientY + "px";
	});

	$(document).mousemove(function(ev) {
		$(".swiper-button-prev, .swiper-button-next, input.button, a, .btn, button, #mode_switcher")
		.off("mouseenter").on("mouseenter", function() {
			$('.bnz-pointer').addClass("bnz-large");
		})
		.off("mouseleave").on("mouseleave", function() {
			$('.bnz-pointer').removeClass("bnz-large");
		});

		$(".main_menu > li > a")
		.off("mouseenter").on("mouseenter", function() {
			$('.bnz-pointer').removeClass("bnz-large");
		});

		$(".swiper-pagination-bullet, .filters-button-group button, .form-control")
		.off("mouseenter").on("mouseenter", function() {
			$('.bnz-pointer').addClass("bnz-small");
		})
		.off("mouseleave").on("mouseleave", function() {
			$('.bnz-pointer').removeClass("bnz-small");
		});

		$(".swiper-slide")
		.off("mouseenter").on("mouseenter", function() {
			$('.bnz-pointer').addClass("bnz-drag");
		})
		.off("mouseleave").on("mouseleave", function() {
			$('.bnz-pointer').removeClass("bnz-drag");
		});

		$(".bnz-pointer-none")
		.off("mouseenter").on("mouseenter", function() {
			$('.bnz-pointer').addClass("bnz-none");
		})
		.off("mouseleave").on("mouseleave", function() {
			$('.bnz-pointer').removeClass("bnz-none");
		});
	});
};