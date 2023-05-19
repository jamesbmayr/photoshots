/*** globals ***/
	/* triggers */
		const TRIGGERS = {
			submit: "submit",
			click: "click"
		}

	/* elements */
		const ELEMENTS = {
			"qrcode-container": document.querySelector("#qrcode-container"),
			"qr-code-print-button": document.querySelector("#qr-code-print-button")
		}

/*** helpers ***/
	/* showToast */
		const TOAST = {
			beforeFade: 200, // ms
			afterFade: 5000, // ms
			element: null,
			timeout: null
		}

		function showToast(data) {
			try {
				// clear existing countdowns
					if (TOAST.timeout) {
						clearTimeout(TOAST.timeout)
						TOAST.timeout = null
					}

				// append
					if (!TOAST.element) {
						TOAST.element = document.createElement("div")
						TOAST.element.id = "toast"
						TOAST.element.setAttribute("visibility", false)
						TOAST.element.setAttribute("success", false)
						document.body.appendChild(TOAST.element)
					}

				// show
					setTimeout(() => {
						TOAST.element.innerHTML = data.message
						TOAST.element.setAttribute("success", data.success || false)
						TOAST.element.setAttribute("visibility", true)
					}, TOAST.beforeFade)

				// hide
					TOAST.timeout = setTimeout(() => {
						TOAST.element.setAttribute("visibility", false)
					}, TOAST.afterFade)
			} catch (error) {console.log(error)}
		}

	/* sendPost */
		function sendPost(options, callback) {
			try {
				// send data to server
					fetch(location.pathname, {method: "POST", body: JSON.stringify(options)})
						.then(function(response){ return response.json() })
						.then(function(data) {
							callback(data || {success: false, message: "unknown error"})
						})
						.catch(function(error) {
							callback({success: false, message: error})
						})
			} catch (error) {console.log(error)}
		}

	/* receivePost */
		function receivePost(data) {
			try {
				// redirect
					if (data.location) {
						window.location = data.location
						return
					}

				// message
					if (data.message) {
						showToast(data)
					}
			} catch (error) {console.log(error)}
		}

	/* displayQRCode */
		function displayQRCode(text, imageContainer) {
			try {
				// clear
					imageContainer.innerHTML = ""

				// get dimensions element
					const x = imageContainer.clientWidth
					const y = imageContainer.clientHeight

				// create image
					new QRCode(imageContainer, {
						text,
						x,
						y,
						correctLevel: QRCode.CorrectLevel.M
					})
			} catch (error) {console.log(error)}
		}

	/* printQRCode */
		ELEMENTS["qr-code-print-button"]?.addEventListener(TRIGGERS.click, printQRCode)
		function printQRCode() {
			try {
				// trigger browser print modal
					window.print()
			} catch (error) {console.log(error)}
		}

/*** game ***/
	/* displayGameQRCode */
		displayGameQRCode()
		function displayGameQRCode() {
			try {
				// get gameId
					const gameId = ELEMENTS["qrcode-container"].innerText.trim()

				// generate code
					displayQRCode(gameId, ELEMENTS["qrcode-container"])
			} catch (error) {console.log(error)}
		}
	