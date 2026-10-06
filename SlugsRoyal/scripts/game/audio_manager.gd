extends Node
## AudioManager - Central audio management for Slugs Royal

# Audio bus configuration
@export var master_volume: float = 1.0
@export var music_volume: float = 0.8
@export var sfx_volume: float = 1.0
@export var ui_volume: float = 1.0

# Audio streams (placeholders - to be replaced with actual audio)
@export var background_music: AudioStream
@export var victory_sound: AudioStream
@export var defeat_sound: AudioStream

# Audio players
var music_player: AudioStreamPlayer
var sfx_players: Array[AudioStreamPlayer] = []
var ui_player: AudioStreamPlayer

# Maximum SFX players to pool
const MAX_SFX_PLAYERS: int = 16

func _ready() -> void:
	_setup_audio_buses()
	_setup_players()

func _setup_audio_buses() -> void:
	# Create audio buses
	var audio_server = AudioServer
	
	# Master bus
	if not audio_server.bus_exists("Master"):
		audio_server.add_bus("Master")
	audio_server.set_bus_volume_db("Master", linear_to_db(master_volume))
	
	# Music bus
	if not audio_server.bus_exists("Music"):
		audio_server.add_bus("Music")
	audio_server.set_bus_volume_db("Music", linear_to_db(music_volume))
	audio_server.set_bus_send("Music", "Master")
	
	# SFX bus
	if not audio_server.bus_exists("SFX"):
		audio_server.add_bus("SFX")
	audio_server.set_bus_volume_db("SFX", linear_to_db(sfx_volume))
	audio_server.set_bus_send("SFX", "Master")
	
	# UI bus
	if not audio_server.bus_exists("UI"):
		audio_server.add_bus("UI")
	audio_server.set_bus_volume_db("UI", linear_to_db(ui_volume))
	audio_server.set_bus_send("UI", "Master")

func _setup_players() -> void:
	# Music player
	music_player = AudioStreamPlayer.new()
	music_player.bus = "Music"
	music_player.loop_mode = AudioStreamPlayer.LOOP_LINEAR
	add_child(music_player)
	
	# UI player
	ui_player = AudioStreamPlayer.new()
	ui_player.bus = "UI"
	add_child(ui_player)
	
	# Pool of SFX players
	for i in range(MAX_SFX_PLAYERS):
		var player = AudioStreamPlayer.new()
		player.bus = "SFX"
		player.finish_mode = AudioStreamPlayer.FINISH_MODE_DISCARD
		add_child(player)
		sfx_players.append(player)

func play_music(stream: AudioStream = null, fade_in: float = 0.5) -> void:
	if stream:
		music_player.stream = stream
	
	if music_player.playing:
		# Fade out current music
		var tween = create_tween()
		tween.tween_property(music_player, "volume_db", -80.0, fade_in)
		await tween.finished
	
	music_player.volume_db = -80.0
	music_player.stream = stream
	music_player.play()
	
	# Fade in new music
	var tween = create_tween()
	tween.tween_property(music_player, "volume_db", linear_to_db(music_volume), fade_in)
	
	if not music_player.playing:
		music_player.play()

func stop_music(fade_out: float = 0.5) -> void:
	if music_player.playing:
		var tween = create_tween()
		tween.tween_property(music_player, "volume_db", -80.0, fade_out)
		await tween.finished
		music_player.stop()

func play_sfx(stream: AudioStream, pitch_variation: float = 0.0) -> void:
	if not stream:
		return
	
	# Find available player
	for player in sfx_players:
		if not player.playing:
			player.stream = stream
			if pitch_variation > 0.0:
				player.pitch_scale = randf_range(1.0 - pitch_variation, 1.0 + pitch_variation)
			else:
				player.pitch_scale = 1.0
			player.play()
			return
	
	# If all players are busy, use the first one (will interrupt)
	sfx_players[0].stream = stream
	sfx_players[0].play()

func play_ui_sound(stream: AudioStream) -> void:
	if not stream:
		return
	
	ui_player.stream = stream
	ui_player.play()

func set_master_volume(volume: float) -> void:
	master_volume = clamp(volume, 0.0, 1.0)
	AudioServer.set_bus_volume_db("Master", linear_to_db(master_volume))

func set_music_volume(volume: float) -> void:
	music_volume = clamp(volume, 0.0, 1.0)
	AudioServer.set_bus_volume_db("Music", linear_to_db(music_volume))

func set_sfx_volume(volume: float) -> void:
	sfx_volume = clamp(volume, 0.0, 1.0)
	AudioServer.set_bus_volume_db("SFX", linear_to_db(sfx_volume))

func set_ui_volume(volume: float) -> void:
	ui_volume = clamp(volume, 0.0, 1.0)
	AudioServer.set_bus_volume_db("UI", linear_to_db(ui_volume))

func play_weapon_sound(weapon_type: String) -> void:
	# Placeholder - implement with actual weapon sounds
	pass

func play_slug_sound(slug_type: String) -> void:
	# Placeholder - implement with actual slug sounds
	pass

func play_footstep() -> void:
	# Placeholder - implement with actual footstep sounds
	pass

func play_victory() -> void:
	if victory_sound:
		play_sfx(victory_sound)

func play_defeat() -> void:
	if defeat_sound:
		play_sfx(defeat_sound)
