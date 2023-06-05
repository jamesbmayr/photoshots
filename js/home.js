/*** globals ***/
	/* triggers */
		const TRIGGERS = {
			submit: "submit",
			click: "click"
		}

	/* elements */
		const ELEMENTS = {
			"logout-user-button": document.querySelector("#logout-user-button"),
			"login-username-input": document.querySelector("#login-username-input"),
			"login-password-input": document.querySelector("#login-password-input"),
			"login-user-button": document.querySelector("#login-user-button"),
			"create-user-button": document.querySelector("#create-user-button"),
			"game-actions": document.querySelector("#game-actions"),
			"join-camera-button": document.querySelector("#join-camera-button"),
			"join-gameid-input": document.querySelector("#join-gameid-input"),
			"join-game-button": document.querySelector("#join-game-button"),
			"create-game-button": document.querySelector("#create-game-button"),
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

/*** logged out ***/
	/* createUser */
		ELEMENTS["create-user-button"]?.addEventListener(TRIGGERS.click, submitCreateUser)
		function submitCreateUser(event) {
			try {
				// get username
					const username = ELEMENTS["login-username-input"] ? ELEMENTS["login-username-input"].value.trim() : null
					if (!username || !username.length) {
						showToast({success: false, message: "enter a username"})
					}

				// get password
					const password = ELEMENTS["login-password-input"] ? ELEMENTS["login-password-input"].value.trim() : null
					if (!password || !password.length) {
						showToast({success: false, message: "enter a password"})
					}

				// send to server
					sendPost({
						action: "createUser",
						name: username,
						password: password
					}, receivePost)
			} catch (error) {console.log(error)}
		}

	/* loginUser */
		ELEMENTS["login-user-button"]?.addEventListener(TRIGGERS.click, submitLoginUser)
		function submitLoginUser(event) {
			try {
				// get username
					const username = ELEMENTS["login-username-input"] ? ELEMENTS["login-username-input"].value.trim() : null
					if (!username || !username.length) {
						showToast({success: false, message: "enter a username"})
					}

				// get password
					const password = ELEMENTS["login-password-input"] ? ELEMENTS["login-password-input"].value.trim() : null
					if (!password || !password.length) {
						showToast({success: false, message: "enter a password"})
					}

				// send to server
					sendPost({
						action: "loginUser",
						name: username,
						password: password
					}, receivePost)
			} catch (error) {console.log(error)}
		}

/*** logged in ***/
	/* logoutUser */
		ELEMENTS["logout-user-button"]?.addEventListener(TRIGGERS.click, submitLogoutUser)
		function submitLogoutUser(event) {
			try {
				// send to server
					sendPost({
						action: "logoutUser"
					}, receivePost)
			} catch (error) {console.log(error)}
		}

	/* createGame */
		ELEMENTS["create-game-button"]?.addEventListener(TRIGGERS.click, submitCreateGame)
		function submitCreateGame(event) {
			try {
				// send to server
					sendPost({
						action: "createGame"
					}, receivePost)
			} catch (error) {console.log(error)}
		}

	/* joinGame */
		ELEMENTS["join-game-button"]?.addEventListener(TRIGGERS.click, submitJoinGame)
		function submitJoinGame(event) {
			try {
				// get gameid
					const gameId = ELEMENTS["join-gameid-input"]?.value.trim().toLowerCase() || null
					if (!gameId || !gameId.length) {
						showToast({success: false, message: "enter a game id"})
						return
					}

				// send to server
					sendPost({
						action: "joinGame",
						gameId: gameId
					}, receivePost)
			} catch (error) {console.log(error)}
		}

/*** qr code reader ***/
	/* startScanning */
		ELEMENTS["join-camera-button"]?.addEventListener(TRIGGERS.click, startScanning)
		function startScanning(event) {
			try {
				// start - first time
					if (!ELEMENTS["qr-code-reader"]) {
						// create element
							const readerElement = document.createElement("div")
								readerElement.id = "qr-code-reader-area"
							ELEMENTS["game-actions"].appendChild(readerElement)

						// create reader
							ELEMENTS["qr-code-reader"] = new Html5Qrcode(readerElement.id)

						// start
							ELEMENTS["join-camera-button"].innerHTML = "scanning"
							startQRcodeDetector()
							return
					}

				// stop scanning
					if (ELEMENTS["qr-code-reader"].getState() == 2) { // SCANNING
						ELEMENTS["qr-code-reader"].pause()
						ELEMENTS["qr-code-reader"].element.setAttribute("hidden", true)
						ELEMENTS["join-camera-button"].innerHTML = "scan"
						return
					}

				// start
					ELEMENTS["join-camera-button"].innerHTML = "scanning"
					startQRcodeDetector()
			} catch (error) {console.log(error)}
		}

	/* startQRcodeDetector */
		function startQRcodeDetector() {
			try {
				// get state
					const qrCodeReaderState = ELEMENTS["qr-code-reader"].getState()

				// scanning --> return
					if (qrCodeReaderState == 2) { // SCANNING
						return
					}

				// paused --> resume
					if (qrCodeReaderState == 3) { // PAUSED
						ELEMENTS["qr-code-reader"].resume()
						ELEMENTS["qr-code-reader"].element.removeAttribute("hidden")
						return
					}

				// not started / unknown --> start
					ELEMENTS["qr-code-reader"].start({facingMode: "environment"}, {fps: 10}, detectQRcode)
									  .then(handleQRcodeElements)
									  .catch(detectQRcode)
			} catch (error) {console.log(error)}
		}

	/* handleQRcodeElements */
		function handleQRcodeElements() {
			try {
				// tasks
					const tasks = {
						removePausedIndicator: true,
						attachVideoElement: true
					}

				// loop
					const taskInterval = setInterval(() => {
						// paused indicator
							if (tasks.removePausedIndicator && ELEMENTS["qr-code-reader"].scannerPausedUiElement) {
								ELEMENTS["qr-code-reader"].scannerPausedUiElement.remove()
								delete tasks.removePausedIndicator
							}

						// video element
							if (tasks.attachVideoElement && ELEMENTS["qr-code-reader"].element.querySelector("video")) {
								ELEMENTS["qr-code-reader"].videoElement = ELEMENTS["qr-code-reader"].element.querySelector("video")
								delete tasks.attachVideoElement
							}

						// no more tasks
							if (!Object.keys(tasks).length) {
								clearInterval(taskInterval)
							}
					}, 100) // ms
			} catch (error) {console.log(error)}
		}

	/* detectQRcode */
		function detectQRcode(text, result) {
			try {
				// no text?
					if (!text || !text.length) {
						return
					}

				// capture text
					ELEMENTS["join-gameid-input"].value = text.trim()

				// stop scanning
					if (ELEMENTS["qr-code-reader"].getState() == 2) { // SCANNING
						ELEMENTS["join-camera-button"].innerHTML = "scan"
						ELEMENTS["qr-code-reader"].pause()
						ELEMENTS["qr-code-reader"].element.setAttribute("hidden", true)
					}

				// click to join
					ELEMENTS["join-game-button"].click()
			} catch (error) {console.log(error)}
		}
