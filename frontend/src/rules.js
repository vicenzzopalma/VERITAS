const rules = {
	whatsapp_control: {
		static: [],
	},

	operator: {
		static: [],
	},

	user: {
		static: [],
	},

	admin: {
		static: [
			"drawer-admin-items:view",
			"audit:view",
			"tickets-manager:showall",
			"user-modal:editProfile",
			"user-modal:editQueues",
			"ticket-options:deleteTicket",
			"ticket-options:transferWhatsapp",
			"contacts-page:deleteContact",
		],
	},
};

export default rules;
