<div align="center" markdown="1">

<!-- <img src=".github/klik-logo.svg" alt="KLiK PoS logo" width="80"/> -->
<h1>KLiK PoS</h1>

**Modern Point of Sale for Retail Businesses**


</div>

<div align="center">
	<img src="./docs/screenshots/PoS_Hero_Image.png" alt="Hero Image" width="100%" />
</div>
<br />
<div align="center">
	<a href="https://klikpos.com">Website</a>
	-
	<a href="https://docs.klikpos.com">Documentation</a>
</div>

---

## KLiK PoS
KLiK PoS is a 100% open-source Point of Sale for ERPNext - simple, modern, responsive, and feature-rich system designed for retail businesses. 

---

### Motivation
The default ERPNext PoS often fall short. They lack strong UX design, miss key compliance requirements (such as ZATCA tax regulations), and have limited social media integration—resulting in a subpar overall experience. Many of ERPNext’s older POS solutions are outdated, don’t support newer versions (v15 and above), and no longer meet today’s business needs.

KLiK PoS was built to close this gap—offering a simple, modern, compliant, and feature-rich POS system designed specifically for ERPNext. Our goal is to deliver a seamless, enjoyable checkout experience—whether in-store or on the go—empowering sales teams to sell smarter, stay compliant, and serve customers with speed and confidence.

---

### Key Features

- **ZATCA Compliance**: Built-in ZATCA compliance by default for Saudi Arabian tax regulations
- **Flexible Sales Modes**: Supports B2C, B2B, or hybrid modes to suit different business needs
- **Smart Invoice Sharing**: Native Email, WhatsApp, and SMS integration for seamless invoice delivery
- **Barcode Scanner Mode**: Dedicated scanner-only mode for fast sales through barcode scanning
- **Multi-Invoice Credit Notes**: Create credit notes for single or multiple invoices effortlessly
- **Customer Management**: Create or edit individual or business customers directly from PoS
- **Payment Processing**: Support for multiple payment methods with seamless round-off (write-off) handling

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

