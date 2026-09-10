// The only script on the site. Posts the updates form to the hyperplexed.io list endpoint,
// whose bot checks expect the hidden "name" field to stay empty and the timestamp to be at
// least 1s and at most 30min old. The list uses double opt-in.
(function () {
	var ENDPOINT = "https://hyperplexed.io/api/sub";
	var MIN_FILL_MS = 1000;
	var STALE_MS = 25 * 60 * 1000;

	var form = document.querySelector("[data-subscribe]");
	if (!form) return;

	var email = form.querySelector("[name=email]");
	var honeypot = form.querySelector("[name=name]");
	var button = form.querySelector("button[type=submit]");
	var done = document.querySelector("[data-subscribe-done]");
	var error = document.querySelector("[data-subscribe-error]");
	var loadedAt = Date.now();
	var sending = false;

	form.addEventListener("submit", function (event) {
		event.preventDefault();

		if (sending || honeypot.value || Date.now() - loadedAt < MIN_FILL_MS) return;

		sending = true;
		button.disabled = true;
		button.textContent = "Subscribing…";
		error.hidden = true;

		var send = function () {
			return fetch(ENDPOINT, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email: email.value,
					source: "contest",
					name: honeypot.value,
					timestamp: loadedAt
				})
			});
		};

		var start = Promise.resolve();

		if (Date.now() - loadedAt > STALE_MS) {
			loadedAt = Date.now();
			start = new Promise(function (resolve) {
				setTimeout(resolve, MIN_FILL_MS + 100);
			});
		}

		start
			.then(send)
			.then(function (response) {
				if (!response.ok) throw new Error("subscribe failed: " + response.status);

				form.hidden = true;
				done.hidden = false;
			})
			.catch(function () {
				error.hidden = false;
			})
			.finally(function () {
				sending = false;
				button.disabled = false;
				button.textContent = "Subscribe";
			});
	});
})();
