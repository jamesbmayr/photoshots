/*** globals ***/
	/* triggers */
		const TRIGGERS = {
			submit: "submit",
			click: "click",
			input: "input"
		}

	/* elements */
		const ELEMENTS = {
			"actions": document.querySelector("#actions"),
			"quit-game-button": document.querySelector("#quit-game-button"),
			"delete-game-button": document.querySelector("#delete-game-button"),
			"start-game-button": document.querySelector("#start-game-button"),
			"qrcode-container": document.querySelector("#qrcode-container"),
			"qr-code-print-button": document.querySelector("#qr-code-print-button"),
			"game-state": document.querySelector("#game-state"),
			"game-state-indicator": document.querySelector("#state-indicator"),
			"game-state-time-start": document.querySelector("#game-state-time-start"),
			"game-state-time-end": document.querySelector("#game-state-time-end"),
			"game-mode": document.querySelector("#game-mode"),
			"game-mode-select": document.querySelector("#game-mode-select"),
			"game-mode-name": document.querySelector("#game-mode-name"),
			"game-mode-win-condition": document.querySelector("#game-mode-win-condition"),
			"game-mode-end-condition": document.querySelector("#game-mode-end-condition"),
			"players-list": document.querySelector("#players-list"),
			"players-list-items": Array.from(document.querySelectorAll(".player")),
			"players-ban-buttons": Array.from(document.querySelectorAll(".player-ban")),
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
						if (data.owner) {
							displayOwner(data.game, data.owner)
						}

						if (data.start) {
							displayStart()
						}

						if (data.end) {
							displayEnd()
						}

						if (data.game) {
							displayGame(data.game)
						}
				} catch (error) {console.log(error)}
			}

/*** display ***/
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

	/* displayOwner */
		function displayOwner(game, ownerId) {
			try {
				// delete game button
					if (!game.timeEnd && !ELEMENTS["delete-game-button"]) {
						ELEMENTS["delete-game-button"] = document.createElement("button")
						ELEMENTS["delete-game-button"].id = "delete-game-button"
						ELEMENTS["delete-game-button"].innerHTML = "delete game"
						ELEMENTS["delete-game-button"].addEventListener(TRIGGERS.click, deleteGame)
						ELEMENTS["actions"].appendChild(ELEMENTS["delete-game-button"])
					}

				// start game button
					if (!game.timeStart && !ELEMENTS["start-game-button"]) {
						ELEMENTS["start-game-button"] = document.createElement("button")
						ELEMENTS["start-game-button"].id = "start-game-button"
						ELEMENTS["start-game-button"].innerHTML = "start game"
						ELEMENTS["start-game-button"].addEventListener(TRIGGERS.click, startGame)
						ELEMENTS["actions"].appendChild(ELEMENTS["start-game-button"])
					}

				// game mode select
					if (!game.timeStart) {
						ELEMENTS["game-mode-select"].removeAttribute("disabled")
					}

				// players ban buttons
					if (!game.timeEnd) {
						ELEMENTS["players-ban-buttons"] = []
						ELEMENTS["players-list-items"].forEach(playerElement => {
							// not self
								const playerId = playerElement.id.split("-")[0]
								if (playerId == ownerId) {
									return
								}

							// ban button
								const banButton = document.createElement("button")
									banButton.className = "player-ban"
									banButton.value = playerId
									banButton.innerHTML = "ban"
									banButton.addEventListener(TRIGGERS.click, banPlayer)
								ELEMENTS["players-ban-buttons"].push(banButton)
								playerElement.querySelector(".player-status").after(banButton)
						})
					}
			} catch (error) {console.log(error)}
		}

	/* displayStart */
		function displayStart() {
			try {
				// ???
			} catch (error) {console.log(error)}
		}

	/* displayEnd */
		function displayEnd() {
			try {
				// ???
			} catch (error) {console.log(error)}
		}

	/* displayGame */
		function displayGame(data) {
			try {
				// ???
			} catch (error) {console.log(error)}
		}

/*** actions - owner ***/
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

	/* startGame */
		ELEMENTS["start-game-button"]?.addEventListener(TRIGGERS.click, startGame)
		function startGame(event) {
			try {
				// data
					const data = {
						action: "startGame"
					}

				// send
					SOCKET.connection?.send(JSON.stringify(data))
			} catch (error) {console.log(error)}
		}

	/* selectMode */
		ELEMENTS["game-mode-select"]?.addEventListener(TRIGGERS.input, selectMode)
		function selectMode(event) {
			try {
				// data
					const data = {
						action: "selectMode",
						mode: ELEMENTS["game-mode-select"].value
					}

				// send
					SOCKET.connection?.send(JSON.stringify(data))
			} catch (error) {console.log(error)}
		}

	/* banPlayer */
		ELEMENTS["players-ban-buttons"]?.forEach(button => button.addEventListener(TRIGGERS.click, banPlayer))
		function banPlayer(event) {
			try {
				// data
					const data = {
						action: "banPlayer",
						playerId: event.target.value
					}

				// send
					SOCKET.connection?.send(JSON.stringify(data))
			} catch (error) {console.log(error)}
		}

/*** actions - all ***/
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

	/* capturePlayer */
		function capturePlayer(playerId) {
			try {
				// data
					const data = {
						action: "capturePlayer",
						playerId: playerId
					}

				// send
					SOCKET.connection?.send(JSON.stringify(data))
			} catch (error) {console.log(error)}
		}
