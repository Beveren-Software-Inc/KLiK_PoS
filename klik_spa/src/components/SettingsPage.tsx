import { useState } from "react"
import { useAuth } from "../hooks/useAuth"
import { useTheme } from "../hooks/useTheme"
import { useI18n } from "../hooks/useI18n"
import { useNavigate } from "react-router-dom"
import {
  User,
  Palette,
  Globe,
  Camera,
  Moon,
  Sun,
  Settings,
  LogOut,
  ChevronRight,
  ArrowLeft,

} from "lucide-react"
import PageHeader from "./ui/PageHeader"

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { language, setLanguage, tl, isRTL } = useI18n()
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState<string>("profile")

  // Generate initials from user's full name
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(word => word.charAt(0).toUpperCase())
      .join("")
      .substring(0, 2)
  }

  const displayName = user?.full_name || user?.name || tl("Guest User")
  const userEmail = user?.email || user?.name || tl("No email")
  // const userRole = user?.role || "User"
  const initials = getInitials(displayName)

  const handleLogout = async () => {
    try {
      await logout()
      navigate("/login")
    } catch (error) {
      console.error('Logout error:', error)
      navigate("/login")
    }
  }

  const settingsSections = [
    {
      id: "profile",
      title: tl("Profile Information"),
      icon: User,
      description: tl("View and manage your profile details")
    },
    {
      id: "appearance",
      title: tl("Appearance"),
      icon: Palette,
      description: tl("Customize the app's look and feel")
    },
    {
      id: "language",
      title: tl("Language & Region"),
      icon: Globe,
      description: tl("Set your preferred language and region")
    },
    {
      id: "account",
      title: tl("Account Settings"),
      icon: Settings,
      description: tl("Manage your account and security")
    }
  ]

  const renderProfileSection = () => (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="bg-gradient-to-r from-beveren-600 to-beveren-700 rounded-xl p-6 text-white">
        <div className={`flex items-center ${isRTL ? "space-x-reverse space-x-4 flex-row-reverse" : "space-x-4"}`}>
          <div className="relative">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center">
              <span className="text-2xl font-bold">{initials}</span>
            </div>
            <button className="absolute bottom-0 right-0 bg-white text-beveren-600 rounded-full p-2 shadow-lg hover:bg-gray-50 transition-colors">
              <Camera size={16} />
            </button>
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold">{displayName}</h2>
            <p className="text-beveren-100 text-lg">{userEmail}</p>
            {/* <div className="flex items-center space-x-2 mt-2">
              <Shield size={16} className="text-beveren-200" />
              <span className="text-beveren-100 font-medium">{userRole}</span>
            </div> */}
          </div>
        </div>
      </div>

      {/* Profile Details */}
      <div className="grid gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">{tl("Personal Information")}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{tl("Full Name")}</label>
              <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
                {user?.full_name || tl("Not provided")}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{tl("Email Address")}</label>
              <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
                {userEmail}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{tl("User ID")}</label>
              <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
                {user?.name || tl("Not provided")}
              </div>
            </div>
            {/* <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{tl("Role")}</label>
              <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
                {userRole}
              </div>
            </div> */}
            {user?.first_name && (
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{tl("First Name")}</label>
                <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
                  {user.first_name}
                </div>
              </div>
            )}
            {user?.last_name && (
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{tl("Last Name")}</label>
                <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
                  {user.last_name}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  const renderAppearanceSection = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">{tl("Theme Settings")}</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className={`flex items-center ${isRTL ? "space-x-reverse space-x-3 flex-row-reverse" : "space-x-3"}`}>
              {theme === 'dark' ? <Moon size={20} className="text-gray-700 dark:text-gray-300" /> : <Sun size={20} className="text-gray-700 dark:text-gray-300" />}
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {theme === 'dark' ? tl('Dark Mode') : tl('Light Mode')}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {theme === 'dark'
                    ? tl('Using dark theme for better low-light viewing')
                    : tl('Using light theme for optimal daytime viewing')
                  }
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                console.log('Theme toggle clicked, current theme:', theme)
                toggleTheme()
              }}
              className="bg-beveren-600 text-white px-4 py-2 rounded-lg hover:bg-beveren-700 transition-colors"
              type="button"
            >
              {tl("Switch to {{theme}}", {
                theme: theme === 'dark' ? tl('Light Mode') : tl('Dark Mode'),
              })}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  const renderLanguageSection = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">{tl("Language Preferences")}</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className={`flex items-center ${isRTL ? "space-x-reverse space-x-3 flex-row-reverse" : "space-x-3"}`}>
              <Globe size={20} className="text-gray-700 dark:text-gray-300" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {tl("Current Language: {{language}}", {
                    language: language === 'en' ? 'English' : 'العربية',
                  })}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {tl("Interface language and text direction")}
                </p>
              </div>
            </div>
            <button
              onClick={() => setLanguage(language === "en" ? "ar" : "en")}
              className="bg-beveren-600 text-white px-4 py-2 rounded-lg hover:bg-beveren-700 transition-colors"
            >
              {tl("Switch to {{language}}", {
                language: language === "en" ? "العربية" : "English",
              })}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  const renderAccountSection = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">{tl("Account Actions")}</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <div className={`flex items-center ${isRTL ? "space-x-reverse space-x-3 flex-row-reverse" : "space-x-3"}`}>
              <LogOut size={20} className="text-red-600 dark:text-red-400" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{tl("Sign Out")}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {tl("Log out of the current POS session")}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              {tl("Sign Out")}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  const renderContent = () => {
    switch (activeSection) {
      case "profile":
        return renderProfileSection()
      case "appearance":
        return renderAppearanceSection()
      case "language":
        return renderLanguageSection()
      case "account":
        return renderAccountSection()
      default:
        return renderProfileSection()
    }
  }

  return (
    <div className="min-h-screen bg-app-bg pb-14">
      <PageHeader
        title={tl("Settings")}
        description={tl("Manage your account preferences and interface behavior.")}
        leading={(
          <button
            onClick={() => navigate('/pos')}
            className={`flex items-center rounded-2xl p-2 text-app-muted transition-colors hover:bg-app-elevated hover:text-foreground ${isRTL ? "space-x-reverse space-x-2 flex-row-reverse" : "space-x-2"}`}
            type="button"
          >
            <ArrowLeft size={20} />
          </button>
        )}
      />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="app-panel rounded-[28px] p-4">
              <nav className="space-y-2">
                {settingsSections.map((section) => {
                  const Icon = section.icon
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                        activeSection === section.id
                          ? 'bg-beveren-50 text-beveren-700 border border-beveren-200 dark:bg-beveren-900 dark:text-beveren-300 dark:border-beveren-700'
                          : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <Icon size={18} />
                        <span className="font-medium">{section.title}</span>
                      </div>
                      <ChevronRight size={16} className="text-gray-400 dark:text-gray-500" />
                    </button>
                  )
                })}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  )
}
