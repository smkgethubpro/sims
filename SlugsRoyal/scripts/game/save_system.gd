extends Node
## SaveSystem - Local save/load functionality for Slugs Royal

# Save file path
const SAVE_DIR := "user://saves/"
const SETTINGS_FILE := "user://settings.json"
const PROGRESS_FILE := "user://progress.json"

# Default settings
const DEFAULT_SETTINGS := {
	"graphics_quality": "medium",
	"sound_volume": 1.0,
	"music_volume": 0.8,
	"sensitivity": 1.0,
	"invert_y": false,
	"fps_limit": 60
}

func _ready() -> void:
	# Ensure save directory exists
	var dir = DirAccess.open("user://")
	if dir:
		if not dir.dir_exists("saves"):
			dir.make_dir("saves")

func save_settings(settings: Dictionary) -> bool:
	var file = FileAccess.open(SETTINGS_FILE, FileAccess.WRITE)
	if not file:
		return false
	
	var json = JSON.new()
	json.stringify(settings)
	file.store_string(json.get_data())
	file.close()
	return true

func load_settings() -> Dictionary:
	if not FileAccess.file_exists(SETTINGS_FILE):
		# Create default settings
		save_settings(DEFAULT_SETTINGS)
		return DEFAULT_SETTINGS.duplicate()
	
	var file = FileAccess.open(SETTINGS_FILE, FileAccess.READ)
	if not file:
		return DEFAULT_SETTINGS.duplicate()
	
	var json = JSON.new()
	var parse_result = json.parse(file.get_as_text())
	file.close()
	
	if parse_result == OK:
		return json.get_data()
	else:
		return DEFAULT_SETTINGS.duplicate()

func save_progress(progress: Dictionary) -> bool:
	var file = FileAccess.open(PROGRESS_FILE, FileAccess.WRITE)
	if not file:
		return false
	
	var json = JSON.new()
	json.stringify(progress)
	file.store_string(json.get_data())
	file.close()
	return true

func load_progress() -> Dictionary:
	if not FileAccess.file_exists(PROGRESS_FILE):
		return {}
	
	var file = FileAccess.open(PROGRESS_FILE, FileAccess.READ)
	if not file:
		return {}
	
	var json = JSON.new()
	var parse_result = json.parse(file.get_as_text())
	file.close()
	
	if parse_result == OK:
		return json.get_data()
	else:
		return {}

func save_game_state(state: Dictionary) -> bool:
	var timestamp = Time.get_ticks_usec()
	var filename = SAVE_DIR + "save_%d.json" % timestamp
	
	var file = FileAccess.open(filename, FileAccess.WRITE)
	if not file:
		return false
	
	var json = JSON.new()
	json.stringify(state)
	file.store_string(json.get_data())
	file.close()
	return true

func load_latest_save() -> Dictionary:
	var dir = DirAccess.open(SAVE_DIR)
	if not dir:
		return {}
	
	var latest_file = ""
	var latest_time = 0
	
	dir.list_dir_begin()
	var filename = ""
	while filename != "":
		filename = dir.get_next_filename()
		if filename.ends_with(".json"):
			var file_time = dir.get_file_modified_time(filename)
			if file_time > latest_time:
				latest_time = file_time
				latest_file = filename
	
	if latest_file != "":
		var file = FileAccess.open(SAVE_DIR + latest_file, FileAccess.READ)
		if file:
			var json = JSON.new()
			var parse_result = json.parse(file.get_as_text())
			file.close()
			if parse_result == OK:
				return json.get_data()
	
	return {}

func get_all_saves() -> Array:
	var saves = []
	var dir = DirAccess.open(SAVE_DIR)
	if not dir:
		return saves
	
	dir.list_dir_begin()
	var filename = ""
	while filename != "":
		filename = dir.get_next_filename()
		if filename.ends_with(".json"):
			var save_data = {}
			save_data["filename"] = filename
			save_data["modified_time"] = dir.get_file_modified_time(filename)
			
			# Try to read save metadata
			var file = FileAccess.open(SAVE_DIR + filename, FileAccess.READ)
			if file:
				var json = JSON.new()
				var parse_result = json.parse(file.get_as_text())
				file.close()
				if parse_result == OK:
					var data = json.get_data()
					save_data["metadata"] = data.get("metadata", {})
			
			saves.append(save_data)
	
	return saves

func delete_save(filename: String) -> bool:
	var path = SAVE_DIR + filename
	if FileAccess.file_exists(path):
		var file = FileAccess.open(path, FileAccess.WRITE)
		if file:
			file.close()
			return DirAccess.remove_absolute(path)
	return false
