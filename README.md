<div align="center" markdown="1">

<img src=".github/klik-logo.svg" alt="KLiK PoS logo" width="80"/>
<h1>KLiK PoS</h1>

**Modern Point of Sale for Retail Businesses**


</div>

<div align="center">
	<img src="./.github/hero.png" alt="Hero Image" width="100%" />
</div>
<br />
<div align="center">
	<a href="https://klikpos.com">Website</a>
	-
	<a href="https://docs.klikpos.com">Documentation</a>
</div>

---

## KLiK PoS
KLiK PoS is a modern, responsive, and feature-rich Point of Sale system designed for retail businesses. It offers a seamless experience for both desktop and mobile, with robust integrations to ERPNext.

---

### Motivation
Retailers need a fast, reliable, and beautiful POS that works everywhere. KLiK PoS was built to solve the pain points of legacy POS systems: clunky UI, poor offline support, and limited extensibility. Our goal is to deliver a delightful checkout experience for staff and customers alike.

---

### Key Features

- **Complete POS System**: Full retail point of sale functionality
- **Mobile-First Design**: Responsive UI for all devices
- **Customer Management**: Add, edit, and manage customers
- **Cart Management**: Intuitive cart with item management
- **Payment Processing**: Multiple payment methods
- **Real-time Dashboard**: Sales analytics and reporting
- **Multi-language Support**: Built-in internationalization
- **Dark Mode**: Light and dark themes
- **Offline Capable**: Works offline with data sync
- **ERPNext Integration**: Seamless backend connectivity

<details>
<summary>View Screenshots</summary>

<div align="center">
	<sub>
		Checkout Screen
	</sub>
</div>

![Checkout](.github/checkout.png)

<div align="center">
	<sub>
		Mobile View
	</sub>
</div>

![Mobile](.github/mobile.png)

</details>

---

### Under the Hood

- [**React 19**](https://react.dev/) + [**TypeScript**](https://www.typescriptlang.org/)
- [**Vite**](https://vitejs.dev/) for lightning-fast builds
- [**Tailwind CSS**](https://tailwindcss.com/) for styling
- [**Zustand**](https://zustand-demo.pmnd.rs/) for state management
- [**ERPNext API**](https://frappeframework.com/) integration

---

## Production Setup

### Managed Hosting
Try KLiK PoS on [Frappe Cloud](https://frappecloud.com) for a hassle-free, secure, and scalable deployment.

### Self Hosting

**Step 1:** Install the app using bench

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app https://github.com/beverensoftware/klik_pos --branch develop
bench install-app klik_pos
```

**Step 2:** Start your bench

```bash
bench start
```

**Step 3:** Access the POS at `http://your-site:8000/klik_pos`

---

## Development Setup

### Backend (Frappe App)

1. [Install Frappe/ERPNext](https://frappeframework.com/docs/v15/user/en/installation)
2. Install KLiK PoS as above
3. Run `bench start`

### Frontend (SPA)

1. Clone the SPA repo:
    ```bash
    git clone https://github.com/beverensoftware/klik_spa.git
    cd klik_spa
    ```
2. Install dependencies:
    ```bash
    npm install
    # or
    yarn install
    ```
3. Start the dev server:
    ```bash
    npm run dev
    # or
    yarn dev
    ```
4. Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Project Structure

```
src/
├── components/     # Reusable UI components
├── pages/          # Page components
├── hooks/          # Custom React hooks
├── stores/         # State management (Zustand)
├── services/       # API services
├── providers/      # Context providers
└── types/          # TypeScript type definitions
```

---

## Configuration

- **Development**: Uses mock data and dev APIs.  
  Edit `FrappeProvider` in `providers/FrappeProviders` to set your local token and backend URL.
- **Production**: Connects to ERPNext backend.
- **Offline Mode**: Local storage fallback.

---

## Compatibility Matrix

| KLiK PoS Branch | Compatible Frappe Version |
|-----------------|--------------------------|
| main            | v15                      |
| develop         | develop                  |

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

This app uses `pre-commit` for code formatting and linting.  
Install and enable it:

```bash
cd apps/klik_pos
pre-commit install
```

---

## License

MIT for open-source components.  
Contact info@beverensoftware.com for commercial licensing.

---

## Support

For support and questions, please contact the development team at [info@beverensoftware.com](mailto:info@beverensoftware.com).

---

<div align="center">
	<a href="https://beverensoftware.com" target="_blank">
		<img src="https://beverensoftware.com/logo.svg" alt="Beveren Software" height="28"/>
	</a>
</div>

