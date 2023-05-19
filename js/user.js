/*** globals ***/
	/* triggers */
		const TRIGGERS = {
			submit: "submit",
			click: "click"
		}

	/* elements */
		const ELEMENTS = {
			"logout-user-button": document.querySelector("#logout-user-button"),
			"join-camera-button": document.querySelector("#join-camera-button"),
			"join-gameid-input": document.querySelector("#join-gameid-input"),
			"join-game-button": document.querySelector("#join-game-button"),
			"create-game-button": document.querySelector("#create-game-button"),
			"update-username-input": document.querySelector("#update-username-input"),
			"update-username-button": document.querySelector("#update-username-button"),
			"old-password-input": document.querySelector("#old-password-input"),
			"new-password-input": document.querySelector("#new-password-input"),
			"update-password-button": document.querySelector("#update-password-button"),
			"delete-password-input": document.querySelector("#delete-password-input"),
			"delete-user-button": document.querySelector("#delete-user-button"),
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

/*** user ***/
	/* displayUserQRCode */
		displayUserQRCode()
		function displayUserQRCode() {
			try {
				// get username
					const username = ELEMENTS["qrcode-container"].innerText.trim()

				// generate code
					displayQRCode(username, ELEMENTS["qrcode-container"])
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

	/* updateUserName */
		ELEMENTS["update-username-button"]?.addEventListener(TRIGGERS.click, submitUpdateUserName)
		function submitUpdateUserName(event) {
			try {
				// get username
					const username = ELEMENTS["update-username-input"]?.value.trim() || null
					if (!username || !username.length) {
						showToast({success: false, message: "enter a username"})
						return
					}

				// send to server
					sendPost({
						action: "updateUserName",
						name: username
					}, receivePost)
			} catch (error) {console.log(error)}
		}

	/* updateUserPassword */
		ELEMENTS["update-password-button"]?.addEventListener(TRIGGERS.click, submitUpdateUserPassword)
		function submitUpdateUserPassword(event) {
			try {
				// get old password
					const oldPassword = ELEMENTS["old-password-input"]?.value.trim() || null
					if (!oldPassword || !oldPassword.length) {
						showToast({success: false, message: "enter current password"})
						return
					}

				// get new password
					const newPassword = ELEMENTS["new-password-input"]?.value.trim() || null
					if (!newPassword || !newPassword.length) {
						showToast({success: false, message: "enter new password"})
						return
					}

				// send to server
					sendPost({
						action: "updateUserPassword",
						oldPassword: oldPassword,
						newPassword: newPassword
					}, receivePost)
			} catch (error) {console.log(error)}
		}

	/* updateUserDelete */
		ELEMENTS["delete-user-button"]?.addEventListener(TRIGGERS.click, submitUpdateUserDelete)
		function submitUpdateUserDelete(event) {
			try {
				// get password
					const password = ELEMENTS["delete-password-input"]?.value.trim() || null
					if (!password || !password.length) {
						showToast({success: false, message: "enter current password"})
						return
					}

				// confirm
					if (!window.confirm("Are you sure you want to delete your account?")) {
						return
					}

				// send to server
					sendPost({
						action: "deleteUser",
						password: password
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
					const gameId = ELEMENTS["join-gameid-input"]?.value.trim() || null
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
	/* scanCode */
		ELEMENTS["join-camera-button"]?.addEventListener(TRIGGERS.click, startScanning)
		function startScanning(event) {
			try {
				// first time
					if (!ELEMENTS["qr-code-reader"]) {
						// create element
							const readerElement = document.createElement("div")
								readerElement.id = "qr-code-reader-area"
							document.body.appendChild(readerElement)

						// create reader
							ELEMENTS["qr-code-reader"] = new Html5Qrcode(readerElement.id)
					}

				// initialize
					startQRcodeDetector()
			} catch (error) {console.log(error)}
		}

	/* startCamera */
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
					const qrCodeReaderState = ELEMENTS["qr-code-reader"].getState()
					if (qrCodeReaderState == 2) { // SCANNING
						ELEMENTS["qr-code-reader"].pause()
						ELEMENTS["qr-code-reader"].element.setAttribute("hidden", true)
					}

				// click to join
					ELEMENTS["join-game-button"].click()
			} catch (error) {console.log(error)}
		}
