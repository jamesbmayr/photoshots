/*** globals ***/
	/* triggers */
		const TRIGGERS = {
			submit: "submit",
			click: "click"
		}

	/* elements */
		const ELEMENTS = {
			"logout-user-button": document.querySelector("#logout-user-button"),
			"update-username-input": document.querySelector("#update-username-input"),
			"update-username-button": document.querySelector("#update-username-button"),
			"old-password-input": document.querySelector("#old-password-input"),
			"new-password-input": document.querySelector("#new-password-input"),
			"update-password-button": document.querySelector("#update-password-button")
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

/*** logged in ***/
	/* logoutUser */
		if (ELEMENTS["logout-user-button"]) {
			ELEMENTS["logout-user-button"].addEventListener(TRIGGERS.click, submitLogoutUser)
		}
		function submitLogoutUser(event) {
			try {
				// send to server
					sendPost({
						action: "logoutUser"
					}, receivePost)
			} catch (error) {console.log(error)}
		}

	/* updateUserName */
		if (ELEMENTS["update-username-button"]) {
			ELEMENTS["update-username-button"].addEventListener(TRIGGERS.click, submitUpdateUserName)
		}
		function submitUpdateUserName(event) {
			try {
				// get username
					const username = ELEMENTS["update-username-input"] ? ELEMENTS["update-username-input"].value.trim() : null
					if (!username || !username.length) {
						showToast({success: false, message: "enter a username"})
					}

				// send to server
					sendPost({
						action: "updateUserName",
						name: username
					}, receivePost)
			} catch (error) {console.log(error)}
		}

	/* updateUserPassword */
		if (ELEMENTS["update-password-button"]) {
			ELEMENTS["update-password-button"].addEventListener(TRIGGERS.click, submitUpdateUserPassword)
		}
		function submitUpdateUserPassword(event) {
			try {
				// get old password
					const oldPassword = ELEMENTS["old-password-input"] ? ELEMENTS["old-password-input"].value.trim() : null
					if (!oldPassword || !oldPassword.length) {
						showToast({success: false, message: "enter current password"})
					}

				// get new password
					const newPassword = ELEMENTS["new-password-input"] ? ELEMENTS["new-password-input"].value.trim() : null
					if (!newPassword || !newPassword.length) {
						showToast({success: false, message: "enter new password"})
					}

				// send to server
					sendPost({
						action: "updateUserPassword",
						oldPassword: oldPassword,
						newPassword: newPassword
					}, receivePost)
			} catch (error) {console.log(error)}
		}
