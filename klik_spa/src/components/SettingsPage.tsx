import React, { useState } from "react"
import { useAuth } from "../hooks/useAuth"
import { useTheme } from "../hooks/useTheme"
import { useI18n } from "../hooks/useI18n"
import { useNavigate } from "react-router-dom"
import {
  User,
  Mail,
  Shield,
  Palette,
  Globe,
  Save,
  Camera,
  Moon,
  Sun,
  Settings,
  LogOut,
  ChevronRight,
  ArrowLeft,
  Home
} from "lucide-react"

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { language, setLanguage, t } = useI18n()
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

  const displayName = user?.full_name || user?.name || "Guest User"
  const userEmail = user?.email || user?.name || "No email"
  const userRole = user?.role || "User"
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
      title: "Profile Information",
      icon: User,
      description: "View and manage your profile details"
    },
    {
      id: "appearance",
      title: "Appearance",
      icon: Palette,
      description: "Customize the app's look and feel"
    },
    {
      id: "language",
      title: "Language & Region",
      icon: Globe,
      description: "Set your preferred language and region"
    },
    {
      id: "account",
      title: "Account Settings",
      icon: Settings,
      description: "Manage your account and security"
    }
  ]

  const renderProfileSection = () => (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="bg-gradient-to-r from-beveren-600 to-beveren-700 rounded-xl p-6 text-white">
        <div className="flex items-center space-x-4">
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
            <div className="flex items-center space-x-2 mt-2">
              <Shield size={16} className="text-beveren-200" />
              <span className="text-beveren-100 font-medium">{userRole}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Details */}
      <div className="grid gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Personal Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
              <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
                {user?.full_name || "Not provided"}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Email Address</label>
              <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
                {userEmail}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">User ID</label>
              <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
                {user?.name || "Not provided"}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
              <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
                {userRole}
              </div>
            </div>
            {user?.first_name && (
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">First Name</label>
                <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
                  {user.first_name}
                </div>
              </div>
            )}
            {user?.last_name && (
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Last Name</label>
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
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Theme Settings</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center space-x-3">
              {theme === 'dark' ? <Moon size={20} className="text-gray-700 dark:text-gray-300" /> : <Sun size={20} className="text-gray-700 dark:text-gray-300" />}
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {theme === 'dark'
                    ? 'Using dark theme for better low-light viewing'
                    : 'Using light theme for optimal daytime viewing'
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
              Switch to {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  const renderLanguageSection = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Language Preferences</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center space-x-3">
              <Globe size={20} className="text-gray-700 dark:text-gray-300" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  Current Language: {language === 'en' ? 'English' : 'Arabic'}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Interface language and text direction
                </p>
              </div>
            </div>
            <button
              onClick={() => setLanguage(language === "en" ? "ar" : "en")}
              className="bg-beveren-600 text-white px-4 py-2 rounded-lg hover:bg-beveren-700 transition-colors"
            >
              Switch to {language === "en" ? "Arabic" : "English"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  const renderAccountSection = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Account Actions</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <div className="flex items-center space-x-3">
              <LogOut size={20} className="text-red-600 dark:text-red-400" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Sign Out</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Sign out of your account and return to login
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Sign Out
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header with Back Button */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <button
              onClick={() => navigate('/pos')}
              className="flex items-center space-x-2 text-gray-600 hover:text-beveren-600 dark:text-gray-300 dark:hover:text-beveren-400 transition-colors group"
              type="button"
            >
              <div className="p-2 rounded-lg bg-gray-100 group-hover:bg-beveren-50 dark:bg-gray-800 dark:group-hover:bg-beveren-900 transition-colors">
                <ArrowLeft size={20} />
              </div>
              <span className="font-medium">Back to POS</span>
            </button>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">Manage your account preferences and settings</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
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
