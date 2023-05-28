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
			"qr-code-container": document.querySelector("#qr-code-container"),
			"qr-code-print-button": document.querySelector("#qr-code-print-button"),
			"game-state": document.querySelector("#game-state"),
			"game-state-indicator": document.querySelector("#state-indicator"),
			"game-mode": document.querySelector("#game-mode"),
			"game-mode-name": document.querySelector("#game-mode-name"),
			"game-mode-select": document.querySelector("#game-mode-select"),
			"game-mode-win-condition": document.querySelector("#game-mode-win-condition"),
			"game-mode-end-condition": document.querySelector("#game-mode-end-condition"),
			"players-list": document.querySelector("#players-list"),
			"players-list-items": Array.from(document.querySelectorAll(".player")),
			"players-ban-buttons": Array.from(document.querySelectorAll(".player-ban")),
		}

	/* state */
		const STATE = {
			playerId: null,
			captureWaitTimeout: null,
			captureWaitMS: 2000, // ms
			game: {
				id: ELEMENTS["qr-code-container"].innerText.trim()
			}
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

	/* convertTime */
		function convertTime(seconds) {
			try {
				if (isNaN(seconds)) {
					return seconds
				}

				return `${Math.floor(seconds / 60)}:${('00' + Math.floor(seconds % 60)).slice(-2)}`
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
						showToast({success: false, message: `disconnected`})
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
								showToast({success: false, message: data.message || `unknown websocket error`})

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
						if (data.player) {
							STATE.playerId = data.player
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
					const gameId = ELEMENTS["qr-code-container"].innerText.trim()

				// generate code
					displayQRCode(gameId, ELEMENTS["qr-code-container"])
			} catch (error) {console.log(error)}
		}

	/* displayGame */
		function displayGame(data) {
			try {
				// wrong id
					if (data.id !== STATE.game.id) {
						showToast({success: false, message: `game id mismatch`})
						return
					}

				// owner
					if (data.ownerId !== STATE.game.ownerId) {
						STATE.game.ownerId = data.ownerId
						displayOwner()
					}

				// mode
					if (data.game.mode.id !== STATE.game.mode?.id) {
						if (!document.activeElement || document.activeElement !== ELEMENTS["game-mode-select"]) {
							STATE.game.mode = data.game.mode
							ELEMENTS["game-mode-select"].value = STATE.game.mode.id
							ELEMENTS["game-mode-win-condition"].innerHTML = STATE.game.mode.winCondition
							ELEMENTS["game-mode-end-condition"].innerHTML = STATE.game.mode.endCondition
						}
					}

				// players
					// upsert
						for (const player of data.game.players) {
							displayPlayer(player)
						}

					// remove quitters
						for (const player of STATE.game.players) {
							if (!data.game.players[player.userId]) {
								delete STATE.game.players[player.userId]
								const playerElement = ELEMENTS["players-list-items"].find(element => element.id == `player-${player.userId}`)
									playerElement?.remove()
							}
						}

				// time
					// start
						if (data.game.timeStart !== STATE.game.timeStart) {
							STATE.game.timeStart = data.game.timeStart
							startScanning()
						}

					// remaining
						if (data.game.timeRemaining !== STATE.game.timeRemaining) {
							STATE.game.timeRemaining = data.game.timeRemaining
							ELEMENTS["game-state-indicator"].innerHTML = STATE.game.timeRemaining
						}

					// end
						if (data.game.timeEnd !== STATE.game.timeEnd) {
							STATE.game.timeEnd = data.game.timeEnd
							stopScanning()
						}
			} catch (error) {console.log(error)}
		}
	
	/* displayOwner */
		function displayOwner() {
			try {
				// not self
					if (STATE.game.ownerId !== STATE.playerId) {
						return
					}

				// message
					showToast({success: true, message: `you are game owner`})

				// delete game button
					if (!STATE.game.timeEnd && !ELEMENTS["delete-game-button"]) {
						ELEMENTS["delete-game-button"] = document.createElement("button")
						ELEMENTS["delete-game-button"].id = "delete-game-button"
						ELEMENTS["delete-game-button"].innerHTML = "delete game"
						ELEMENTS["delete-game-button"].addEventListener(TRIGGERS.click, deleteGame)
						ELEMENTS["actions"].appendChild(ELEMENTS["delete-game-button"])
					}

				// start game button
					if (!STATE.game.timeStart && !ELEMENTS["start-game-button"]) {
						ELEMENTS["start-game-button"] = document.createElement("button")
						ELEMENTS["start-game-button"].id = "start-game-button"
						ELEMENTS["start-game-button"].innerHTML = "start game"
						ELEMENTS["start-game-button"].addEventListener(TRIGGERS.click, startGame)
						ELEMENTS["actions"].appendChild(ELEMENTS["start-game-button"])
					}

				// game mode select
					if (!STATE.game.timeStart) {
						ELEMENTS["game-mode-select"].removeAttribute("disabled")
					}

				// players ban buttons
					if (!STATE.game.timeEnd) {
						ELEMENTS["players-ban-buttons"] = []
						ELEMENTS["players-list-items"].forEach(playerElement => displayBanButton(playerElement))
					}
			} catch (error) {console.log(error)}
		}

	/* displayBanButton */
		function displayBanButton(playerElement) {
			try {
				// not self
					const playerId = playerElement.id.split("-")[0]
					if (playerId == STATE.playerId) {
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
			} catch (error) {console.log(error)}
		}

	/* displayPlayer */
		function displayPlayer(player) {
			try {
				// playerId
					const playerId = player.userId
					const status = STATE.game.timeEnd ? (player.win ? "win" : player.loss ? "loss" : "unknown") :
								   !player.connected ? "disconnected" :
								   STATE.game.timeStart ? (player.cooldown ? "stunned" : player.target ? "in" : "out") :
								   "ready"

				// not in game data
					if (!STATE.game.players[playerId]) {
						STATE.game.players[playerId] = player
					}

				// existing playerElement
					const playerElement = ELEMENTS["players-list-items"].find(element => element.id == `player-${playerId}`)
					if (playerElement) {
						playerElement.querySelector(".player-status")?.innerHTML = status
						playerElement.querySelector(".player-stat-shots")?.innerHTML = player.shots
						playerElement.querySelector(".player-stat-stuns")?.innerHTML = player.stuns
						playerElement.querySelector(".player-stat-time-in")?.innerHTML = player.timeIn
						playerElement.querySelector(".player-stat-time-out")?.innerHTML = player.timeOut
						return
					}

				// new playerElement
					const newPlayerElement = document.createElement("div")
						newPlayerElement.className = "player"
						newPlayerElement.id = `player-${playerId}`
					ELEMENTS["players-list"].appendChild(newPlayerElement)
					ELEMENTS["players-list-items"].push(newPlayerElement)

				// info
					const playerName = document.createElement("h3")
						playerName.className = "player-name"
						playerName.innerHTML = player.name
					newPlayerElement.appendChild(playerName)

					const playerStatus = document.createElement("h4")
						playerStatus.className = "player-status"
						playerStatus.innerHTML = status
					newPlayerElement.appendChild(playerStatus)
				
				// stats
					const playerShots = document.createElement("li")
						playerShots.className = "player-stat"
					newPlayerElement.appendChild(playerShots)
						const playerShotsLabel = document.createElement("span")
							playerShotsLabel.innerHTML = "shots"
						playerShots.appendChild(playerShotsLabel)
						const playerShotsValue = document.createElement("span")
							playerShotsValue.className = "player-stat-shots"
							playerShotsValue.innerHTML = player.shots
						playerShots.appendChild(playerShotsValue)
					
					const playerStuns = document.createElement("li")
						playerStuns.className = "player-stat"
					newPlayerElement.appendChild(playerStuns)
						const playerStunsLabel = document.createElement("span")
							playerStunsLabel.innerHTML = "stuns"
						playerStuns.appendChild(playerStunsLabel)
						const playerStunsValue = document.createElement("span")
							playerStunsValue.className = "player-stat-stuns"
							playerStunsValue.innerHTML = player.stuns
						playerStuns.appendChild(playerStunsValue)

					const playerTimeIn = document.createElement("li")
						playerTimeIn.className = "player-stat"
					newPlayerElement.appendChild(playerTimeIn)
						const playerTimeInLabel = document.createElement("span")
							playerTimeInLabel.innerHTML = "time in"
						playerTimeIn.appendChild(playerTimeInLabel)
						const playerTimeInValue = document.createElement("span")
							playerTimeInValue.className = "player-stat-time-in"
							playerTimeInValue.innerHTML = player.timeIn
						playerTimeIn.appendChild(playerTimeInValue)

					const playerTimeOut = document.createElement("li")
						playerTimeOut.className = "player-stat"
					newPlayerElement.appendChild(playerTimeOut)
						const playerTimeOutLabel = document.createElement("span")
							playerTimeOutLabel.innerHTML = "time out"
						playerTimeOut.appendChild(playerTimeOutLabel)
						const playerTimeOutValue = document.createElement("span")
							playerTimeOutValue.className = "player-stat-time-out"
							playerTimeOutValue.innerHTML = player.timeOut
						playerTimeOut.appendChild(playerTimeOutValue)

				// ban button
					if (!STATE.game.timeEnd && STATE.playerId && STATE.game.ownerId == STATE.playerId && STATE.playerId !== playerId) {
						displayBanButton(newPlayerElement)
					}
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

/*** qr code reader ***/
	/* startScanning */
		function startScanning(event) {
			try {
				// not a player
					if (!STATE.playerId) {
						return
					}

				// first time
					if (!ELEMENTS["qr-code-reader"]) {
						// create element
							const readerElement = document.createElement("div")
								readerElement.id = "qr-code-reader-area"
							ELEMENTS["qr-code-reader-area"] = readerElement
							document.body.appendChild(readerElement)

						// create reader
							ELEMENTS["qr-code-reader"] = new Html5Qrcode(readerElement.id)
					}

				// initialize
					startQRcodeDetector()
			} catch (error) {console.log(error)}
		}

	/* startQRcodeDetector */
		function startQRcodeDetector() {
			try {
				// clear timeout
					clearTimeout(STATE.captureWaitTimeout)
					STATE.captureWaitTimeout = null

				// get state
					const qrCodeReaderState = ELEMENTS["qr-code-reader"].getState()

				// scanning --> return
					if (qrCodeReaderState == 2) { // SCANNING
						return
					}

				// paused --> resume
					if (qrCodeReaderState == 3) { // PAUSED
						ELEMENTS["qr-code-reader"].resume()
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

				// stop scanning
					const qrCodeReaderState = ELEMENTS["qr-code-reader"].getState()
					if (qrCodeReaderState == 2) { // SCANNING
						ELEMENTS["qr-code-reader"].pause()
						STATE.captureWaitTimeout = setTimeout(startQRcodeDetector, STATE.captureWaitMS)
					}

				// capture
					const playerId = text.trim().replace(/\-/g, "")
					capturePlayer(playerId)
			} catch (error) {console.log(error)}
		}

	/* stopScanning */
		function stopScanning() {
			try {
				// no reader
					if (!ELEMENTS["qr-code-reader"]) {
						return
					}

				// qr code scanner
					ELEMENTS["qr-code-reader"]?.pause()
					delete ELEMENTS["qr-code-reader"]

					ELEMENTS["qr-code-reader-area"]?.remove()
					delete ELEMENTS["qr-code-reader-area"]
			} catch (error) {console.log(error)}
		}
