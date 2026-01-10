/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],

    theme: {
        extend: {
            textColor: {
                primary: '#0f172a', // slate-900
                secondary: '#475569', // slate-600
                'on-dark': '#f8fafc', // slate-50
            },
        },
    },
    plugins: [],
}
