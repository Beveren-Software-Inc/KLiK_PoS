import { useState } from "react"
import { useAuth } from "../hooks/useAuth"
import { useNavigate } from "react-router-dom"
import { useI18n } from "../hooks/useI18n"
import { useTheme } from "../hooks/useTheme"
import {
  ArrowLeft,
  User,
  Globe,
  Palette,
  CreditCard,
  Shield,
  Database,
  Info,
  Moon,
  Sun,
  Monitor,
  Bell,
  Wifi,
  Download,
  Upload,
  LogOut,
} from "lucide-react"

export default function SettingsPage() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const { t, language, setLanguage, isRTL } = useI18n()
  const { theme, setTheme, toggleTheme } = useTheme()
  const [activeSection, setActiveSection] = useState("profile")

  const handleLogout = async () => {
    try {
      await logout()
      navigate("/login")
    } catch (error) {
      console.error('Logout error:', error)
      // Still redirect even if logout fails
      navigate("/login")
    }
  }

  const settingsSections = [
    { id: "profile", name: "Profile", icon: User },
    { id: "display", name: "Display", icon: Palette },
    { id: "system", name: "System", icon: Globe },
    { id: "pos", name: "POS Settings", icon: CreditCard },
    { id: "notifications", name: "Notifications", icon: Bell },
    { id: "security", name: "Security", icon: Shield },
    { id: "backup", name: "Backup & Sync", icon: Database },
    { id: "about", name: "About", icon: Info },
  ]

  const renderProfileSettings = () => (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <div className="w-20 h-20 bg-beveren-600 rounded-full flex items-center justify-center">
          <span className="text-white font-bold text-2xl">NS</span>
        </div>
        <div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Nick Szabo</h3>
          <p className="text-gray-600 dark:text-gray-400">Store Manager</p>
          <p className="text-sm text-gray-500 dark:text-gray-500">nick.szabo@beveren.com</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Full Name</label>
          <input
            type="text"
            defaultValue="Nick Szabo"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email</label>
          <input
            type="email"
            defaultValue="nick.szabo@beveren.com"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Phone</label>
          <input
            type="tel"
            defaultValue="+1 (555) 123-4567"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Role</label>
          <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
            <option>Store Manager</option>
            <option>Cashier</option>
            <option>Administrator</option>
          </select>
        </div>
      </div>
    </div>
  )

  const renderDisplaySettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Theme Settings</h3>
        <div className="grid grid-cols-3 gap-4">
          <button
            onClick={() => setTheme("light")}
            className={`p-4 rounded-lg border-2 transition-colors ${
              theme === "light"
                ? "border-beveren-500 bg-beveren-50 dark:bg-beveren-900"
                : "border-gray-300 dark:border-gray-600 hover:border-gray-400"
            }`}
          >
            <Sun className="w-6 h-6 mx-auto mb-2 text-gray-700 dark:text-gray-300" />
            <div className="text-sm font-medium text-gray-900 dark:text-white">Light</div>
          </button>
          <button
            onClick={() => setTheme("dark")}
            className={`p-4 rounded-lg border-2 transition-colors ${
              theme === "dark"
                ? "border-beveren-500 bg-beveren-50 dark:bg-beveren-900"
                : "border-gray-300 dark:border-gray-600 hover:border-gray-400"
            }`}
          >
            <Moon className="w-6 h-6 mx-auto mb-2 text-gray-700 dark:text-gray-300" />
            <div className="text-sm font-medium text-gray-900 dark:text-white">Dark</div>
          </button>
          <button className="p-4 rounded-lg border-2 border-gray-300 dark:border-gray-600 hover:border-gray-400 transition-colors">
            <Monitor className="w-6 h-6 mx-auto mb-2 text-gray-700 dark:text-gray-300" />
            <div className="text-sm font-medium text-gray-900 dark:text-white">System</div>
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Language & Region</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="en">English</option>
              <option value="ar">العربية (Arabic)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Currency</label>
            <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              <option>USD ($)</option>
              <option>SAR (ر.س)</option>
              <option>EUR (€)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )

  const renderSystemSettings = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Store Name</label>
          <input
            type="text"
            defaultValue="Beveren Store"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Timezone</label>
          <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
            <option>UTC-5 (Eastern Time)</option>
            <option>UTC+3 (Saudi Arabia)</option>
            <option>UTC+0 (GMT)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Receipt Footer</label>
          <input
            type="text"
            defaultValue="Thank you for shopping with us!"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>
      </div>
    </div>
  )

  const renderPOSSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Receipt Settings</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-700 dark:text-gray-300">Auto-print receipts</span>
            <button className="w-12 h-6 bg-beveren-600 rounded-full relative">
              <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5"></div>
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-700 dark:text-gray-300">Show item images on receipt</span>
            <button className="w-12 h-6 bg-gray-300 dark:bg-gray-600 rounded-full relative">
              <div className="w-5 h-5 bg-white rounded-full absolute left-0.5 top-0.5"></div>
            </button>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Payment Methods</h3>
        <div className="space-y-3">
          {["Cash", "Credit Card", "Debit Card", "Digital Wallet", "Gift Card"].map((method) => (
            <div
              key={method}
              className="flex items-center justify-between p-3 border border-gray-300 dark:border-gray-600 rounded-lg"
            >
              <span className="text-gray-700 dark:text-gray-300">{method}</span>
              <button className="w-12 h-6 bg-beveren-600 rounded-full relative">
                <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5"></div>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const renderNotificationSettings = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        {["Low stock alerts", "Daily sales summary", "Payment notifications", "System updates", "Security alerts"].map(
          (notification) => (
            <div
              key={notification}
              className="flex items-center justify-between p-3 border border-gray-300 dark:border-gray-600 rounded-lg"
            >
              <span className="text-gray-700 dark:text-gray-300">{notification}</span>
              <button className="w-12 h-6 bg-beveren-600 rounded-full relative">
                <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5"></div>
              </button>
            </div>
          ),
        )}
      </div>
    </div>
  )

  const renderSecuritySettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Password & Authentication</h3>
        <div className="space-y-4">
          <button className="w-full p-3 text-left border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <div className="font-medium text-gray-900 dark:text-white">Change Password</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Last changed 30 days ago</div>
          </button>
          <div className="flex items-center justify-between p-3 border border-gray-300 dark:border-gray-600 rounded-lg">
            <div>
              <div className="font-medium text-gray-900 dark:text-white">Two-Factor Authentication</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Add an extra layer of security</div>
            </div>
            <button className="w-12 h-6 bg-gray-300 dark:bg-gray-600 rounded-full relative">
              <div className="w-5 h-5 bg-white rounded-full absolute left-0.5 top-0.5"></div>
            </button>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Session Management</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-700 dark:text-gray-300">Auto-logout after inactivity</span>
            <select className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              <option>15 minutes</option>
              <option>30 minutes</option>
              <option>1 hour</option>
              <option>Never</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )

  const renderBackupSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Data Backup</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 border border-gray-300 dark:border-gray-600 rounded-lg">
            <div>
              <div className="font-medium text-gray-900 dark:text-white">Automatic Backup</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Daily backup to cloud storage</div>
            </div>
            <button className="w-12 h-6 bg-beveren-600 rounded-full relative">
              <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5"></div>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <button className="flex items-center justify-center p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <Download className="w-5 h-5 mr-2 text-gray-600 dark:text-gray-400" />
              <span className="text-gray-700 dark:text-gray-300">Export Data</span>
            </button>
            <button className="flex items-center justify-center p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <Upload className="w-5 h-5 mr-2 text-gray-600 dark:text-gray-400" />
              <span className="text-gray-700 dark:text-gray-300">Import Data</span>
            </button>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Sync Settings</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-700 dark:text-gray-300">Sync frequency</span>
            <select className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              <option>Real-time</option>
              <option>Every 5 minutes</option>
              <option>Every hour</option>
              <option>Manual only</option>
            </select>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
            <Wifi className="w-4 h-4" />
            <span>Last sync: 2 minutes ago</span>
          </div>
        </div>
      </div>
    </div>
  )

  const renderAboutSettings = () => (
    <div className="space-y-6">
      <div className="text-center">
        <img src="/assets/klik_pos/klik_spa/beveren-logo-180.png" alt="KLiK PoS" className="w-16 h-16 mx-auto mb-4 rounded-full object-cover" />
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">KLiK PoS</h3>
        <p className="text-gray-600 dark:text-gray-400">Version 2.1.0</p>
      </div>

      <div className="space-y-4">
        <div className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">System Information</h4>
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex justify-between">
              <span>Platform:</span>
              <span>Web Application</span>
            </div>
            <div className="flex justify-between">
              <span>Database:</span>
              <span>Connected</span>
            </div>
            <div className="flex justify-between">
              <span>Storage Used:</span>
              <span>2.3 GB / 10 GB</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <button className="w-full p-3 text-left border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <span className="text-gray-700 dark:text-gray-300">Privacy Policy</span>
          </button>
          <button className="w-full p-3 text-left border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <span className="text-gray-700 dark:text-gray-300">Terms of Service</span>
          </button>
          <button className="w-full p-3 text-left border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <span className="text-gray-700 dark:text-gray-300">Contact Support</span>
          </button>
        </div>
      </div>
    </div>
  )

  const renderContent = () => {
    switch (activeSection) {
      case "profile":
        return renderProfileSettings()
      case "display":
        return renderDisplaySettings()
      case "system":
        return renderSystemSettings()
      case "pos":
        return renderPOSSettings()
      case "notifications":
        return renderNotificationSettings()
      case "security":
        return renderSecuritySettings()
      case "backup":
        return renderBackupSettings()
      case "about":
        return renderAboutSettings()
      default:
        return renderProfileSettings()
    }
  }

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 ${isRTL ? "rtl" : "ltr"}`}>
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <nav className="space-y-2">
                {settingsSections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      activeSection === section.id
                        ? "bg-beveren-50 dark:bg-beveren-900/20 text-beveren-600 dark:text-beveren-400"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                  >
                    <section.icon className="w-5 h-5" />
                    <span className="font-medium">{section.name}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Content */}
          <div className="lg:col-span-3">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                {settingsSections.find((s) => s.id === activeSection)?.name}
              </h2>
              {renderContent()}

              {/* Save Button */}
              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-end space-x-3">
                  <button className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    Cancel
                  </button>
                  <button className="px-4 py-2 bg-beveren-600 text-white rounded-lg hover:bg-beveren-700 transition-colors">
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
