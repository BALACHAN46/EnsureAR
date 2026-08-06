
    $(document).ready(function () {

        $("input, textarea").on("input change", function () {
            $(this).removeClass("inputValidation-error");
        });

    $("#sendEmailContactUs").on("click", function (e) {
        e.preventDefault(); // prevent page refresh
    let $msg1 = $("#formMessageContact"); // message div
    $msg1.text("");
    let $btn = $(this); // store button reference
    $btn.prop("disabled", true).text("Sending...").css({"background-color":"#d9ae3c", "color": "White" }); // disable + change text

    // Clear old errors
    $("input, textarea").removeClass("inputValidation-error");

    let name = $("input[name='name']").val().trim();
    let email = $("input[name='email']").val().trim();
    let subject = $("input[name='subject']").val().trim();
    let message = $("textarea[name='message']").val().trim();

    let hasError = false;

    // Simple validation
    if (!name) {
        $("input[name='name']").addClass("inputValidation-error").focus();
    hasError = true;
        }

    if (!email) {
        $("input[name='email']").addClass("inputValidation-error");
    if (!hasError) $("input[name='email']").focus();
    hasError = true;
        }

    // Basic email regex check
    let emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailPattern.test(email)) {
        $("input[name='email']").addClass("inputValidation-error").focus();
    hasError = true;
        }

    if (hasError) {
        $btn.prop("disabled", false).text("Send Mail").css({ "background-color": "", "color": "" });

    return;
        }

    // Prepare data
    let formData = {
        Name: name,
    ToEmail: email,
    Subject: subject,
    Body: message
        };

    fetch("/SendEmailOnFormSubmit", {
        method: "POST",
    headers: {"Content-Type": "application/json" },
    body: JSON.stringify(formData)
        })
        .then(res => res.json())
        .then(data => {
        $("input[name='name']").val("");
    $("input[name='email']").val("");
    $("input[name='subject']").val("");
    $("textarea[name='message']").val("");
    $msg1.text("✅ Sent successfully!").fadeIn();

        setTimeout(() => {
        $msg1.fadeOut();
        }, 2000);

        console.log("Success:", data)})
        .catch(err => {console.error("Error:", err);
    $msg1.text("❌ Something went wrong. Please try again.").fadeIn();
;            setTimeout(() => {
        $msg1.fadeOut();
            }, 2000);
        })
        .finally(() => {
        $btn.prop("disabled", false).text("Send Mail").css({ "background-color": "", "color": "" });
        });
    });
});
