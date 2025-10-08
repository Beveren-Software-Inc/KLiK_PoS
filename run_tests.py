#!/usr/bin/env python3
"""
Test runner script for klik_pos customer tests
Run this script to test the customer API functions locally
"""

import os
import sys

# Add the klik_pos directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

if __name__ == "__main__":
	import unittest

	# Discover and run tests
	loader = unittest.TestLoader()
	suite = loader.discover("klik_pos.tests", pattern="test_*.py")

	runner = unittest.TextTestRunner(verbosity=2)
	result = runner.run(suite)

	# Exit with appropriate code
	sys.exit(0 if result.wasSuccessful() else 1)
