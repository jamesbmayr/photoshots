/*** globals ***/
	/* triggers */
		const TRIGGERS = {
			submit: "submit",
			click: "click"
		}

	/* elements */
		const ELEMENTS = {
			"quit-game-button": document.querySelector("#quit-game-button"),
			"delete-game-button": document.querySelector("#delete-game-button"),
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

	/*** socket ***/
		/* start */
			const SOCKET = {
				connection: null,
				createLoop: null,
				createInterval: 5 * 1000, // ms
				pingLoop: null,
				pingInterval: 60 * 1000, // ms
				keepPinging: null
			}

		/* createSocket */
			createSocket()
			SOCKET.createLoop = setInterval(createSocket, SOCKET.createInterval)
			function createSocket() {
				try {
					// already created
						if (SOCKET.connection) {
							clearInterval(SOCKET.createLoop)
							return
						}

					// connect
						SOCKET.connection = new WebSocket(location.href.replace("http","ws"))
						SOCKET.connection.onopen = () => {
							SOCKET.connection.send(null)
						}

					// disconnect
						SOCKET.connection.onerror = error => {
							showToast({success: false, message: error})
						}
						SOCKET.connection.onclose = () => {
							showToast({success: false, message: "disconnected"})
							SOCKET.connection = null
							
							createSocket()
							SOCKET.createLoop = setInterval(createSocket, SOCKET.createInterval)
						}

					// message
						SOCKET.connection.onmessage = message => {
							try {
								SOCKET.keepPinging = true
								const post = JSON.parse(message.data)
								if (post && (typeof post == "object")) {
									receiveSocket(post)
								}
							}
							catch (error) {console.log(error)}
						}

					// ping
						SOCKET.keepPinging = false
						clearInterval(SOCKET.pingLoop)
						SOCKET.pingLoop = setInterval(pingServer, SOCKET.pingInterval)
				} catch (error) {console.log(error)}
			}

		/* pingServer */
			function pingServer() {
				try {
					if (!SOCKET.keepPinging) {
						return
					}

					SOCKET.keepPinging = false
					fetch("/ping", {method: "GET"})
						.then(response => response.json())
						.then(data => {})
				} catch (error) {console.log(error)}
			}

		/* receiveSocket */
			function receiveSocket(data) {
				try {
					// meta
						// redirect
							if (data.location) {
								window.location = data.location
								return
							}
							
						// failure
							if (!data || !data.success) {
								showToast({success: false, message: data.message || "unknown websocket error"})

								// force close
									if (data.close) {
										SOCKET.connection.onclose = () => {}
										SOCKET.connection.close()
									}
								return
							}

						// toast
							if (data.message) {
								showToast(data)
							}

					// data
						console.log(data) // ???
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

	/* quitGame */
		ELEMENTS["quit-game-button"]?.addEventListener(TRIGGERS.click, quitGame)
		function quitGame(event) {
			try {
				// data
					const data = {
						action: "quitGame"
					}

				// send
					SOCKET.connection?.send(JSON.stringify(data))
			} catch (error) {console.log(error)}
		}
	
	/* deleteGame */
		ELEMENTS["delete-game-button"]?.addEventListener(TRIGGERS.click, deleteGame)
		function deleteGame(event) {
			try {
				// data
					const data = {
						action: "deleteGame"
					}

				// send
					SOCKET.connection?.send(JSON.stringify(data))
			} catch (error) {console.log(error)}
		}
	