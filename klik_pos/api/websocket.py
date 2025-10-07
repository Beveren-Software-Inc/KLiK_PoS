import asyncio
import json
import threading
import time

import frappe
import websockets
from frappe import _
from frappe.utils import get_site_name

# Store active connections
active_connections = set()

@frappe.whitelist(allow_guest=True)
def stock_updates():
	"""WebSocket endpoint for real-time stock updates"""
	return "WebSocket endpoint - use WebSocket connection"


async def handle_client(websocket, path):
	"""Handle WebSocket client connections"""
	active_connections.add(websocket)
	print(f"Client connected. Total connections: {len(active_connections)}")

	try:
		async for message in websocket:
			try:
				data = json.loads(message)

				if data.get("type") == "ping":
					await websocket.send(json.dumps({"type": "pong"}))
				elif data.get("type") == "subscribe_stock_updates":
					# Client wants to receive stock updates
					await websocket.send(
						json.dumps(
							{
								"type": "subscription_confirmed",
								"data": {"message": "Subscribed to stock updates"},
							}
						)
					)

			except json.JSONDecodeError:
				await websocket.send(
					json.dumps({"type": "error", "data": {"message": "Invalid JSON format"}})
				)

	except websockets.exceptions.ConnectionClosed:
		pass
	finally:
		active_connections.discard(websocket)
		print(f"Client disconnected. Total connections: {len(active_connections)}")


def broadcast_stock_update(item_code: str, available: float):
	"""Broadcast stock update to all connected clients"""
	if not active_connections:
		return

	message = {
		"type": "stock_update",
		"data": {
			"item_code": item_code,
			"available": available,
			"timestamp": int(time.time() * 1000),
		},
	}

	disconnected = set()
	for websocket in active_connections:
		try:
			task = asyncio.create_task(websocket.send(json.dumps(message)))
			task.add_done_callback(lambda t: t.exception())
		except Exception:
			disconnected.add(websocket)

	for websocket in disconnected:
		active_connections.discard(websocket)


def start_websocket_server():
	"""Start WebSocket server in a separate thread"""

	def run_server():
		loop = asyncio.new_event_loop()
		asyncio.set_event_loop(loop)

		start_server = websockets.serve(
			handle_client,
			"localhost",
			8765,  
			ping_interval=30,
			ping_timeout=10,
		)

		loop.run_until_complete(start_server)
		loop.run_forever()

	# Start server in background thread
	server_thread = threading.Thread(target=run_server, daemon=True)
	server_thread.start()
	print("WebSocket server started on port 8765")


try:
	start_websocket_server()
except Exception as e:
	print(f"Failed to start WebSocket server: {e}")


# Hook to broadcast stock updates when stock changes
def on_stock_ledger_entry_after_submit(doc, method):
	"""Hook to broadcast stock updates when stock ledger entries are created"""
	if doc.doctype == "Stock Ledger Entry":
		broadcast_stock_update(doc.item_code, doc.actual_qty)


# Register the hook
frappe.get_hooks().setdefault("after_insert", []).append(
	{"Stock Ledger Entry": "klik_pos.api.websocket.on_stock_ledger_entry_after_submit"}
)
