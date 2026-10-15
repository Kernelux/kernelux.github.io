{
	"patcher": {
		"fileversion": 1,
		"appversion": {
			"major": 9,
			"minor": 0,
			"revision": 0,
			"architecture": "x64",
			"modernui": 1
		},
		"classnamespace": "box",
		"rect": [
			50,
			80,
			1500,
			900
		],
		"openinpresentation": 1,
		"default_fontsize": 10,
		"default_fontface": 0,
		"default_fontname": "Arial",
		"gridonopen": 1,
		"gridsize": [
			8,
			8
		],
		"gridsnaponopen": 1,
		"objectsnaponopen": 1,
		"enablehscroll": 1,
		"enablevscroll": 1,
		"devicewidth": 2376,
		"description": "SliceKit - slices from many samples on the MIDI keyboard",
		"digest": "",
		"tags": "",
		"boxes": [
			{
				"box": {
					"id": "obj-1",
					"maxclass": "newobj",
					"text": "v8 slicekit.js ---src ---skstate ---skview ---cap",
					"numinlets": 1,
					"numoutlets": 5,
					"outlettype": [
						"",
						"",
						"",
						"",
						""
					],
					"patching_rect": [
						400,
						2629,
						380,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-2",
					"maxclass": "comment",
					"text": "INPUTS  (everything below feeds inlet 0 of the glue)",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						20,
						14,
						340,
						20
					]
				}
			},
			{
				"box": {
					"id": "obj-3",
					"maxclass": "newobj",
					"text": "live.thisdevice",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"bang",
						"int",
						"int"
					],
					"patching_rect": [
						20,
						44,
						120,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-4",
					"maxclass": "message",
					"text": "init",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						20,
						78,
						40,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-5",
					"maxclass": "comment",
					"text": "MIDI",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						20,
						116,
						60,
						20
					]
				}
			},
			{
				"box": {
					"id": "obj-6",
					"maxclass": "newobj",
					"text": "midiin",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						"int"
					],
					"patching_rect": [
						20,
						138,
						56,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-7",
					"maxclass": "newobj",
					"text": "midiparse",
					"numinlets": 1,
					"numoutlets": 7,
					"outlettype": [
						"",
						"",
						"",
						"",
						"",
						"",
						""
					],
					"patching_rect": [
						20,
						168,
						250,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-8",
					"maxclass": "newobj",
					"text": "prepend note",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						20,
						204,
						86,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-9",
					"maxclass": "newobj",
					"text": "prepend polypressure",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						112,
						204,
						134,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-10",
					"maxclass": "newobj",
					"text": "prepend pressure",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						252,
						204,
						110,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-11",
					"maxclass": "comment",
					"text": "DROP / LOAD",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						20,
						252,
						120,
						20
					]
				}
			},
			{
				"box": {
					"id": "obj-12",
					"maxclass": "live.drop",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 0,
					"patching_rect": [
						20,
						274,
						80,
						40
					],
					"presentation": 1,
					"presentation_rect": [
						4,
						19,
						80,
						88
					],
					"varname": "sk_drop"
				}
			},
			{
				"box": {
					"id": "obj-13",
					"maxclass": "newobj",
					"text": "prepend drop",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						20,
						328,
						86,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-14",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						20,
						372,
						80,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						4,
						111,
						80,
						18
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Load Sample",
							"parameter_shortname": "Load",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_load",
					"mode": 0,
					"text": "Load",
					"texton": "Load",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-15",
					"maxclass": "newobj",
					"text": "route bang 1",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						""
					],
					"patching_rect": [
						110,
						372,
						86,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-16",
					"maxclass": "newobj",
					"text": "opendialog sound",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"bang"
					],
					"patching_rect": [
						20,
						404,
						110,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-17",
					"maxclass": "newobj",
					"text": "prepend load",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						20,
						440,
						86,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-18",
					"maxclass": "comment",
					"text": "CAPTURE FOLDER  (folder chooser)",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						20,
						484,
						220,
						20
					]
				}
			},
			{
				"box": {
					"id": "obj-19",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						20,
						508,
						80,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1944,
						137,
						46,
						18
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Capture Folder",
							"parameter_shortname": "Folder…",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_capfolder",
					"mode": 0,
					"text": "Folder…",
					"texton": "Folder…",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-20",
					"maxclass": "newobj",
					"text": "route bang 1",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						""
					],
					"patching_rect": [
						110,
						508,
						86,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-21",
					"maxclass": "newobj",
					"text": "opendialog fold",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"bang"
					],
					"patching_rect": [
						20,
						540,
						104,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-22",
					"maxclass": "newobj",
					"text": "prepend kit capturefolder",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						20,
						576,
						164,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-23",
					"maxclass": "comment",
					"text": "SAMPLE  - source <param>   (feedback src_* -> prepend set; src_simplers -> umenu directly)",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						400,
						50,
						640,
						20
					]
				}
			},
			{
				"box": {
					"id": "obj-24",
					"maxclass": "newobj",
					"text": "route src_playmode src_trigmode src_slicemode src_sensitivity src_beatdiv src_regions src_bpm src_minslice src_snap src_simplers",
					"numinlets": 1,
					"numoutlets": 11,
					"outlettype": [
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						""
					],
					"patching_rect": [
						400,
						76,
						1216,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-25",
					"maxclass": "live.tab",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						400,
						154,
						108,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						700,
						22,
						108,
						18
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Sample Play Mode",
							"parameter_shortname": "Play",
							"parameter_type": 2,
							"parameter_enum": [
								"Mono",
								"Poly",
								"Thru"
							],
							"parameter_mmax": 2,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_src_playmode",
					"num_lines_patching": 1,
					"num_lines_presentation": 1,
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-26",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						124,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-27",
					"maxclass": "newobj",
					"text": "prepend source playmode",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						182,
						152,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-28",
					"maxclass": "live.tab",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						576,
						154,
						72,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						812,
						22,
						72,
						18
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Sample Trig Mode",
							"parameter_shortname": "Trig",
							"parameter_type": 2,
							"parameter_enum": [
								"Trig",
								"Gate"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_src_trigmode",
					"num_lines_patching": 1,
					"num_lines_presentation": 1,
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-29",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						576,
						124,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-30",
					"maxclass": "newobj",
					"text": "prepend source trigmode",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						576,
						182,
						152,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-31",
					"maxclass": "live.menu",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						752,
						154,
						78,
						17
					],
					"presentation": 1,
					"presentation_rect": [
						700,
						77,
						78,
						17
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Slice Mode",
							"parameter_shortname": "Slice",
							"parameter_type": 2,
							"parameter_enum": [
								"Transient",
								"Beat",
								"Region",
								"Manual"
							],
							"parameter_mmax": 3,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_src_slicemode",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-32",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						752,
						124,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-33",
					"maxclass": "newobj",
					"text": "prepend source slicemode",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						752,
						181,
						158,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-34",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						928,
						154,
						41,
						48
					],
					"presentation": 1,
					"presentation_rect": [
						892,
						22,
						41,
						48
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Slice Sensitivity",
							"parameter_shortname": "Sens",
							"parameter_type": 0,
							"parameter_mmin": 0,
							"parameter_mmax": 100,
							"parameter_unitstyle": 5,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_src_sens"
				}
			},
			{
				"box": {
					"id": "obj-35",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						928,
						124,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-36",
					"maxclass": "newobj",
					"text": "prepend source sensitivity",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						928,
						212,
						170,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-37",
					"maxclass": "live.menu",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						1104,
						154,
						58,
						17
					],
					"presentation": 1,
					"presentation_rect": [
						782,
						77,
						58,
						17
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Slice Beat Division",
							"parameter_shortname": "Beat Div",
							"parameter_type": 2,
							"parameter_enum": [
								"1/16",
								"1/16T",
								"1/8",
								"1/8T",
								"1/4",
								"1/4T",
								"1/2",
								"1/2T",
								"1 Bar",
								"2 Bars",
								"4 Bars"
							],
							"parameter_mmax": 10,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_src_beatdiv",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-38",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1104,
						124,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-39",
					"maxclass": "newobj",
					"text": "prepend source beatdiv",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1104,
						181,
						146,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-40",
					"maxclass": "live.numbox",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						1280,
						154,
						40,
						15
					],
					"presentation": 1,
					"presentation_rect": [
						844,
						77,
						40,
						15
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Slice Regions",
							"parameter_shortname": "Regions",
							"parameter_type": 1,
							"parameter_mmin": 2,
							"parameter_mmax": 128,
							"parameter_unitstyle": 0,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_src_regions",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-41",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1280,
						124,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-42",
					"maxclass": "newobj",
					"text": "prepend source regions",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1280,
						179,
						146,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-43",
					"maxclass": "live.numbox",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						1456,
						154,
						40,
						15
					],
					"presentation": 1,
					"presentation_rect": [
						700,
						119,
						40,
						15
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Slice BPM",
							"parameter_shortname": "BPM",
							"parameter_type": 0,
							"parameter_mmin": 0,
							"parameter_mmax": 250,
							"parameter_unitstyle": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_src_bpm",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-44",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1456,
						124,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-45",
					"maxclass": "newobj",
					"text": "prepend source bpm",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1456,
						179,
						122,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-46",
					"maxclass": "live.numbox",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						400,
						312,
						40,
						15
					],
					"presentation": 1,
					"presentation_rect": [
						744,
						119,
						40,
						15
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Slice Min Length",
							"parameter_shortname": "Min Slice",
							"parameter_type": 1,
							"parameter_mmin": 5,
							"parameter_mmax": 500,
							"parameter_unitstyle": 2,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_src_minslice",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-47",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						282,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-48",
					"maxclass": "newobj",
					"text": "prepend source minslice",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						337,
						152,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-49",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						576,
						312,
						44,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						788,
						118,
						44,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Slice Snap",
							"parameter_shortname": "Snap",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_src_snap",
					"mode": 1,
					"text": "Snap",
					"texton": "Snap",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-50",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						576,
						282,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-51",
					"maxclass": "newobj",
					"text": "prepend source snap",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						576,
						338,
						128,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-52",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						752,
						312,
						56,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						836,
						118,
						56,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Slice Reslice",
							"parameter_shortname": "Reslice",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_src_reslice",
					"mode": 0,
					"text": "Reslice",
					"texton": "Reslice",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-53",
					"maxclass": "newobj",
					"text": "route bang 1",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						""
					],
					"patching_rect": [
						752,
						338,
						86,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-54",
					"maxclass": "message",
					"text": "source reslice",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						752,
						366,
						98,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-55",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						928,
						312,
						80,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						4,
						133,
						80,
						18
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Sample Remove",
							"parameter_shortname": "Remove",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_src_remove",
					"mode": 0,
					"text": "Remove",
					"texton": "Remove",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-56",
					"maxclass": "newobj",
					"text": "route bang 1",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						""
					],
					"patching_rect": [
						928,
						340,
						86,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-57",
					"maxclass": "message",
					"text": "source remove",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						928,
						368,
						92,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-58",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						1104,
						312,
						70,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						700,
						142,
						70,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Find Simplers",
							"parameter_shortname": "Find Simplers",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_simplerscan",
					"mode": 0,
					"text": "Find Simplers",
					"texton": "Find Simplers",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-59",
					"maxclass": "newobj",
					"text": "route bang 1",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						""
					],
					"patching_rect": [
						1104,
						338,
						86,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-60",
					"maxclass": "message",
					"text": "source simplerscan",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1104,
						366,
						122,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-61",
					"maxclass": "umenu",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"int",
						"",
						""
					],
					"parameter_enable": 0,
					"fontsize": 9,
					"patching_rect": [
						1280,
						312,
						158,
						17
					],
					"presentation": 1,
					"presentation_rect": [
						774,
						142,
						158,
						17
					],
					"varname": "sk_simplers"
				}
			},
			{
				"box": {
					"id": "obj-62",
					"maxclass": "comment",
					"text": "raw: clear / append",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1280,
						282,
						130,
						20
					]
				}
			},
			{
				"box": {
					"id": "obj-63",
					"maxclass": "newobj",
					"text": "prepend source fromsimpler",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1280,
						339,
						170,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-64",
					"maxclass": "comment",
					"text": "PAD  - pad <param>   (feedback pad_* -> prepend set)",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						400,
						434,
						640,
						20
					]
				}
			},
			{
				"box": {
					"id": "obj-65",
					"maxclass": "newobj",
					"text": "route pad_reverse pad_pitch pad_fine pad_gain pad_attack pad_decay pad_sustain pad_release pad_start pad_loop pad_loopsize pad_looppos pad_cutoff pad_drive pad_lock pad_layerarm pad_duparm pad_spreadparam pad_spreadcount pad_spreadstep",
					"numinlets": 1,
					"numoutlets": 21,
					"outlettype": [
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						""
					],
					"patching_rect": [
						400,
						460,
						1216,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-66",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						400,
						538,
						46,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						948,
						122,
						46,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pad Reverse",
							"parameter_shortname": "Rev",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_reverse",
					"mode": 1,
					"text": "Rev",
					"texton": "Rev",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-67",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						508,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-68",
					"maxclass": "newobj",
					"text": "prepend pad reverse",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						564,
						128,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-69",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						576,
						538,
						41,
						48
					],
					"presentation": 1,
					"presentation_rect": [
						948,
						18,
						41,
						48
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pad Pitch",
							"parameter_shortname": "Pitch",
							"parameter_type": 1,
							"parameter_mmin": -48,
							"parameter_mmax": 48,
							"parameter_unitstyle": 7,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_pitch"
				}
			},
			{
				"box": {
					"id": "obj-70",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						576,
						508,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-71",
					"maxclass": "newobj",
					"text": "prepend pad pitch",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						576,
						596,
						116,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-72",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						752,
						538,
						41,
						48
					],
					"presentation": 1,
					"presentation_rect": [
						991,
						18,
						41,
						48
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pad Fine",
							"parameter_shortname": "Fine",
							"parameter_type": 1,
							"parameter_mmin": -100,
							"parameter_mmax": 100,
							"parameter_unitstyle": 9,
							"parameter_units": "ct",
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_fine"
				}
			},
			{
				"box": {
					"id": "obj-73",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						752,
						508,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-74",
					"maxclass": "newobj",
					"text": "prepend pad fine",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						752,
						596,
						110,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-75",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						928,
						538,
						41,
						48
					],
					"presentation": 1,
					"presentation_rect": [
						1034,
						18,
						41,
						48
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pad Gain",
							"parameter_shortname": "Gain",
							"parameter_type": 0,
							"parameter_mmin": -60,
							"parameter_mmax": 12,
							"parameter_unitstyle": 4,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_gain"
				}
			},
			{
				"box": {
					"id": "obj-76",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						928,
						508,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-77",
					"maxclass": "newobj",
					"text": "prepend pad gain",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						928,
						596,
						110,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-78",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						1104,
						538,
						41,
						48
					],
					"presentation": 1,
					"presentation_rect": [
						1120,
						18,
						41,
						48
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pad Attack",
							"parameter_shortname": "Atk",
							"parameter_type": 0,
							"parameter_mmin": 0,
							"parameter_mmax": 2000,
							"parameter_unitstyle": 2,
							"parameter_exponent": 3,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_attack"
				}
			},
			{
				"box": {
					"id": "obj-79",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1104,
						508,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-80",
					"maxclass": "newobj",
					"text": "prepend pad attack",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1104,
						596,
						122,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-81",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						1280,
						538,
						41,
						48
					],
					"presentation": 1,
					"presentation_rect": [
						1163,
						18,
						41,
						48
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pad Decay",
							"parameter_shortname": "Dec",
							"parameter_type": 0,
							"parameter_mmin": 0,
							"parameter_mmax": 5000,
							"parameter_unitstyle": 2,
							"parameter_exponent": 3,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_decay"
				}
			},
			{
				"box": {
					"id": "obj-82",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1280,
						508,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-83",
					"maxclass": "newobj",
					"text": "prepend pad decay",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1280,
						596,
						116,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-84",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						1456,
						538,
						41,
						48
					],
					"presentation": 1,
					"presentation_rect": [
						1206,
						18,
						41,
						48
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pad Sustain",
							"parameter_shortname": "Sus",
							"parameter_type": 0,
							"parameter_mmin": 0,
							"parameter_mmax": 100,
							"parameter_unitstyle": 5,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_sustain"
				}
			},
			{
				"box": {
					"id": "obj-85",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1456,
						508,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-86",
					"maxclass": "newobj",
					"text": "prepend pad sustain",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1456,
						596,
						128,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-87",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						400,
						696,
						41,
						48
					],
					"presentation": 1,
					"presentation_rect": [
						1249,
						18,
						41,
						48
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pad Release",
							"parameter_shortname": "Rel",
							"parameter_type": 0,
							"parameter_mmin": 0,
							"parameter_mmax": 5000,
							"parameter_unitstyle": 2,
							"parameter_exponent": 3,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_release"
				}
			},
			{
				"box": {
					"id": "obj-88",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						666,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-89",
					"maxclass": "newobj",
					"text": "prepend pad release",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						754,
						128,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-90",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						576,
						696,
						41,
						48
					],
					"presentation": 1,
					"presentation_rect": [
						1077,
						18,
						41,
						48
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pad Start",
							"parameter_shortname": "Start",
							"parameter_type": 0,
							"parameter_mmin": 0,
							"parameter_mmax": 1000,
							"parameter_unitstyle": 2,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_start"
				}
			},
			{
				"box": {
					"id": "obj-91",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						576,
						666,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-92",
					"maxclass": "newobj",
					"text": "prepend pad start",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						576,
						754,
						116,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-93",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						752,
						696,
						46,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						996,
						122,
						46,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pad Loop",
							"parameter_shortname": "Loop",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_loop",
					"mode": 1,
					"text": "Loop",
					"texton": "Loop",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-94",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						752,
						666,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-95",
					"maxclass": "newobj",
					"text": "prepend pad loop",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						752,
						722,
						110,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-96",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						928,
						696,
						41,
						48
					],
					"presentation": 1,
					"presentation_rect": [
						948,
						68,
						41,
						48
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pad Loop Size",
							"parameter_shortname": "LpSize",
							"parameter_type": 0,
							"parameter_mmin": 1,
							"parameter_mmax": 500,
							"parameter_unitstyle": 2,
							"parameter_exponent": 3,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_loopsize"
				}
			},
			{
				"box": {
					"id": "obj-97",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						928,
						666,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-98",
					"maxclass": "newobj",
					"text": "prepend pad loopsize",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						928,
						754,
						134,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-99",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						1104,
						696,
						41,
						48
					],
					"presentation": 1,
					"presentation_rect": [
						991,
						68,
						41,
						48
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pad Loop Pos",
							"parameter_shortname": "LpPos",
							"parameter_type": 0,
							"parameter_mmin": 0,
							"parameter_mmax": 100,
							"parameter_unitstyle": 5,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_looppos"
				}
			},
			{
				"box": {
					"id": "obj-100",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1104,
						666,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-101",
					"maxclass": "newobj",
					"text": "prepend pad looppos",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1104,
						754,
						128,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-102",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						1280,
						696,
						41,
						48
					],
					"presentation": 1,
					"presentation_rect": [
						1034,
						68,
						41,
						48
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pad Cutoff",
							"parameter_shortname": "Cutoff",
							"parameter_type": 0,
							"parameter_mmin": 20,
							"parameter_mmax": 20000,
							"parameter_unitstyle": 3,
							"parameter_exponent": 3,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_cutoff"
				}
			},
			{
				"box": {
					"id": "obj-103",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1280,
						666,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-104",
					"maxclass": "newobj",
					"text": "prepend pad cutoff",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1280,
						754,
						122,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-105",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						1456,
						696,
						41,
						48
					],
					"presentation": 1,
					"presentation_rect": [
						1077,
						68,
						41,
						48
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pad Drive",
							"parameter_shortname": "Drive",
							"parameter_type": 0,
							"parameter_mmin": 0,
							"parameter_mmax": 100,
							"parameter_unitstyle": 5,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_drive"
				}
			},
			{
				"box": {
					"id": "obj-106",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1456,
						666,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-107",
					"maxclass": "newobj",
					"text": "prepend pad drive",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1456,
						754,
						116,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-108",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						400,
						854,
						46,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						1044,
						122,
						46,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pad Lock",
							"parameter_shortname": "Lock",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_lock",
					"mode": 1,
					"text": "Lock",
					"texton": "Lock",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-109",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						824,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-110",
					"maxclass": "newobj",
					"text": "prepend pad lock",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						880,
						110,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-111",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						576,
						854,
						46,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						948,
						142,
						46,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pad Similar Prev",
							"parameter_shortname": "‹ Sim",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_simprev",
					"mode": 0,
					"text": "‹ Sim",
					"texton": "‹ Sim",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-112",
					"maxclass": "newobj",
					"text": "route bang 1",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						""
					],
					"patching_rect": [
						576,
						880,
						86,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-113",
					"maxclass": "message",
					"text": "pad similar -1",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						576,
						908,
						98,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-114",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						752,
						854,
						46,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						996,
						142,
						46,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pad Similar Next",
							"parameter_shortname": "Sim ›",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_simnext",
					"mode": 0,
					"text": "Sim ›",
					"texton": "Sim ›",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-115",
					"maxclass": "newobj",
					"text": "route bang 1",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						""
					],
					"patching_rect": [
						752,
						880,
						86,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-116",
					"maxclass": "message",
					"text": "pad similar 1",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						752,
						908,
						92,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-117",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						928,
						854,
						46,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						1092,
						122,
						46,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pad Layer Arm",
							"parameter_shortname": "Layer",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_layer",
					"mode": 1,
					"text": "Layer",
					"texton": "Layer",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-118",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						928,
						824,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-119",
					"maxclass": "newobj",
					"text": "prepend pad layerarm",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						928,
						880,
						134,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-120",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						1104,
						854,
						46,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						1140,
						122,
						46,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pad Duplicate Arm",
							"parameter_shortname": "Dup",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_dup",
					"mode": 1,
					"text": "Dup",
					"texton": "Dup",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-121",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1104,
						824,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-122",
					"maxclass": "newobj",
					"text": "prepend pad duparm",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1104,
						880,
						122,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-123",
					"maxclass": "live.menu",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						1280,
						854,
						54,
						17
					],
					"presentation": 1,
					"presentation_rect": [
						1126,
						81,
						54,
						17
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Spread Param",
							"parameter_shortname": "Spread",
							"parameter_type": 2,
							"parameter_enum": [
								"Pitch",
								"Decay",
								"Start",
								"Cutoff"
							],
							"parameter_mmax": 3,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_spreadparam",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-124",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1280,
						824,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-125",
					"maxclass": "newobj",
					"text": "prepend pad spreadparam",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1280,
						881,
						152,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-126",
					"maxclass": "live.numbox",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						1456,
						854,
						38,
						15
					],
					"presentation": 1,
					"presentation_rect": [
						1184,
						81,
						38,
						15
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Spread Count",
							"parameter_shortname": "Count",
							"parameter_type": 1,
							"parameter_mmin": 2,
							"parameter_mmax": 16,
							"parameter_unitstyle": 0,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_spreadcount",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-127",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1456,
						824,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-128",
					"maxclass": "newobj",
					"text": "prepend pad spreadcount",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1456,
						879,
						152,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-129",
					"maxclass": "live.numbox",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						400,
						981,
						38,
						15
					],
					"presentation": 1,
					"presentation_rect": [
						1226,
						81,
						38,
						15
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Spread Step",
							"parameter_shortname": "Step",
							"parameter_type": 0,
							"parameter_mmin": -24,
							"parameter_mmax": 24,
							"parameter_unitstyle": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_spreadstep",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-130",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						951,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-131",
					"maxclass": "newobj",
					"text": "prepend pad spreadstep",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						1006,
						146,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-132",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						576,
						981,
						54,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						1126,
						102,
						54,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pad Spread",
							"parameter_shortname": "Spread",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_spread",
					"mode": 0,
					"text": "Spread",
					"texton": "Spread",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-133",
					"maxclass": "newobj",
					"text": "route bang 1",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						""
					],
					"patching_rect": [
						576,
						1007,
						86,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-134",
					"maxclass": "message",
					"text": "pad spread",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						576,
						1035,
						74,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-135",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						752,
						981,
						60,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						1044,
						142,
						60,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pad Apply To Sample",
							"parameter_shortname": "→ Sample",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_apply",
					"mode": 0,
					"text": "→ Sample",
					"texton": "→ Sample",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-136",
					"maxclass": "newobj",
					"text": "route bang 1",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						""
					],
					"patching_rect": [
						752,
						1007,
						86,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-137",
					"maxclass": "message",
					"text": "pad applysource",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						752,
						1035,
						104,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-138",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						928,
						981,
						46,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						1108,
						142,
						46,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pad Clear",
							"parameter_shortname": "Clear",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_clear",
					"mode": 0,
					"text": "Clear",
					"texton": "Clear",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-139",
					"maxclass": "newobj",
					"text": "route bang 1",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						""
					],
					"patching_rect": [
						928,
						1007,
						86,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-140",
					"maxclass": "message",
					"text": "pad clear",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						928,
						1035,
						68,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-141",
					"maxclass": "comment",
					"text": "PERFORM + KIT  - kit <param>   (feedback kit_* -> prepend set)",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						400,
						1101,
						640,
						20
					]
				}
			},
			{
				"box": {
					"id": "obj-142",
					"maxclass": "newobj",
					"text": "route kit_slot kit_layout kit_zonealign kit_sortby kit_root kit_shufflemode kit_shufflescope kit_seed kit_flip kit_bestn kit_chokescope kit_modzone kit_modstart kit_velsens kit_pressure2level",
					"numinlets": 1,
					"numoutlets": 16,
					"outlettype": [
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						""
					],
					"patching_rect": [
						400,
						1127,
						1216,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-143",
					"maxclass": "live.tab",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						400,
						1205,
						168,
						20
					],
					"presentation": 1,
					"presentation_rect": [
						1642,
						22,
						168,
						20
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Slot",
							"parameter_shortname": "Slot",
							"parameter_type": 2,
							"parameter_enum": [
								"A",
								"B",
								"C",
								"D",
								"E",
								"F",
								"G",
								"H"
							],
							"parameter_mmax": 7,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								0
							],
							"parameter_invisible": 0
						}
					},
					"varname": "sk_slot",
					"num_lines_patching": 1,
					"num_lines_presentation": 1,
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-144",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						1175,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-145",
					"maxclass": "newobj",
					"text": "prepend kit slot",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						1235,
						110,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-146",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						576,
						1205,
						41,
						48
					],
					"presentation": 1,
					"presentation_rect": [
						1642,
						52,
						41,
						48
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Chaos",
							"parameter_shortname": "Chaos",
							"parameter_type": 0,
							"parameter_mmin": 0,
							"parameter_mmax": 100,
							"parameter_unitstyle": 5,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								0
							],
							"parameter_invisible": 0
						}
					},
					"varname": "sk_chaos"
				}
			},
			{
				"box": {
					"id": "obj-147",
					"maxclass": "newobj",
					"text": "prepend kit chaos",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						576,
						1263,
						116,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-148",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						752,
						1205,
						72,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1738,
						52,
						72,
						18
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Repeat",
							"parameter_shortname": "Repeat",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								0
							],
							"parameter_invisible": 0
						}
					},
					"varname": "sk_repeat",
					"mode": 1,
					"text": "Repeat",
					"texton": "Repeat",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-149",
					"maxclass": "newobj",
					"text": "prepend kit repeat",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						752,
						1233,
						122,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-150",
					"maxclass": "live.menu",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						928,
						1205,
						72,
						17
					],
					"presentation": 1,
					"presentation_rect": [
						1738,
						87,
						72,
						17
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Rate",
							"parameter_shortname": "Rate",
							"parameter_type": 2,
							"parameter_enum": [
								"1/4",
								"1/8",
								"1/8T",
								"1/16",
								"1/16T",
								"1/32",
								"1/32T",
								"1/64"
							],
							"parameter_mmax": 7,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								3
							],
							"parameter_invisible": 0
						}
					},
					"varname": "sk_rate",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-151",
					"maxclass": "newobj",
					"text": "prepend kit rate",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						928,
						1232,
						110,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-152",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						1104,
						1205,
						41,
						48
					],
					"presentation": 1,
					"presentation_rect": [
						1688,
						52,
						41,
						48
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Swing",
							"parameter_shortname": "Swing",
							"parameter_type": 0,
							"parameter_mmin": 0,
							"parameter_mmax": 100,
							"parameter_unitstyle": 5,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								0
							],
							"parameter_invisible": 0
						}
					},
					"varname": "sk_swing"
				}
			},
			{
				"box": {
					"id": "obj-153",
					"maxclass": "newobj",
					"text": "prepend kit swing",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1104,
						1263,
						116,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-154",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						1280,
						1205,
						72,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						1738,
						108,
						72,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Alt",
							"parameter_shortname": "Alt",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								0
							],
							"parameter_invisible": 0
						}
					},
					"varname": "sk_alt",
					"mode": 1,
					"text": "Alt",
					"texton": "Alt",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-155",
					"maxclass": "newobj",
					"text": "prepend kit alt",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1280,
						1231,
						104,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-156",
					"maxclass": "live.menu",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						1456,
						1205,
						80,
						17
					],
					"presentation": 1,
					"presentation_rect": [
						1542,
						139,
						80,
						17
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Copy Slot To",
							"parameter_shortname": "Copy",
							"parameter_type": 2,
							"parameter_enum": [
								"Copy→A",
								"Copy→B",
								"Copy→C",
								"Copy→D",
								"Copy→E",
								"Copy→F",
								"Copy→G",
								"Copy→H"
							],
							"parameter_mmax": 7,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_copyslot",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-157",
					"maxclass": "newobj",
					"text": "prepend kit copyslot",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1456,
						1232,
						134,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-158",
					"maxclass": "live.menu",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						400,
						1363,
						70,
						17
					],
					"presentation": 1,
					"presentation_rect": [
						1308,
						31,
						70,
						17
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Kit Layout",
							"parameter_shortname": "Layout",
							"parameter_type": 2,
							"parameter_enum": [
								"Zones",
								"Interleave",
								"Sorted"
							],
							"parameter_mmax": 2,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_layout",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-159",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						1333,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-160",
					"maxclass": "newobj",
					"text": "prepend kit layout",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						1390,
						122,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-161",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						576,
						1363,
						34,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						1442,
						31,
						34,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Kit Zone Align",
							"parameter_shortname": "Oct",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_zonealign",
					"mode": 1,
					"text": "Oct",
					"texton": "Oct",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-162",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						576,
						1333,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-163",
					"maxclass": "newobj",
					"text": "prepend kit zonealign",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						576,
						1389,
						140,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-164",
					"maxclass": "live.menu",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						752,
						1363,
						56,
						17
					],
					"presentation": 1,
					"presentation_rect": [
						1382,
						31,
						56,
						17
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Kit Sort By",
							"parameter_shortname": "Sort",
							"parameter_type": 2,
							"parameter_enum": [
								"Bright",
								"Loud",
								"Length"
							],
							"parameter_mmax": 2,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_sortby",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-165",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						752,
						1333,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-166",
					"maxclass": "newobj",
					"text": "prepend kit sortby",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						752,
						1390,
						122,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-167",
					"maxclass": "live.numbox",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						928,
						1363,
						40,
						15
					],
					"presentation": 1,
					"presentation_rect": [
						1480,
						31,
						40,
						15
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Kit Root Key",
							"parameter_shortname": "Root",
							"parameter_type": 1,
							"parameter_mmin": 0,
							"parameter_mmax": 127,
							"parameter_unitstyle": 8,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_root",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-168",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						928,
						1333,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-169",
					"maxclass": "newobj",
					"text": "prepend kit root",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						928,
						1388,
						110,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-170",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						1104,
						1363,
						48,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						1524,
						31,
						48,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Kit Relayout",
							"parameter_shortname": "Layout",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_relayout",
					"mode": 0,
					"text": "Layout",
					"texton": "Layout",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-171",
					"maxclass": "newobj",
					"text": "route bang 1",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						""
					],
					"patching_rect": [
						1104,
						1389,
						86,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-172",
					"maxclass": "message",
					"text": "kit relayout",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1104,
						1417,
						86,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-173",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						1280,
						1363,
						52,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1308,
						64,
						52,
						18
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Kit Shuffle",
							"parameter_shortname": "Shuffle",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_shuffle",
					"mode": 0,
					"text": "Shuffle",
					"texton": "Shuffle",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-174",
					"maxclass": "newobj",
					"text": "route bang 1",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						""
					],
					"patching_rect": [
						1280,
						1391,
						86,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-175",
					"maxclass": "message",
					"text": "kit shuffle",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1280,
						1419,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-176",
					"maxclass": "live.tab",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						1456,
						1363,
						66,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1364,
						64,
						66,
						18
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Shuffle Mode",
							"parameter_shortname": "Mode",
							"parameter_type": 2,
							"parameter_enum": [
								"Chaos",
								"Smart"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_shufflemode",
					"num_lines_patching": 1,
					"num_lines_presentation": 1,
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-177",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1456,
						1333,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-178",
					"maxclass": "newobj",
					"text": "prepend kit shufflemode",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1456,
						1391,
						152,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-179",
					"maxclass": "live.tab",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						400,
						1491,
						66,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1434,
						64,
						66,
						18
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Shuffle Scope",
							"parameter_shortname": "Scope",
							"parameter_type": 2,
							"parameter_enum": [
								"All",
								"Sample"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_shufflescope",
					"num_lines_patching": 1,
					"num_lines_presentation": 1,
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-180",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						1461,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-181",
					"maxclass": "newobj",
					"text": "prepend kit shufflescope",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						1519,
						158,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-182",
					"maxclass": "live.numbox",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						576,
						1491,
						40,
						15
					],
					"presentation": 1,
					"presentation_rect": [
						1504,
						66,
						40,
						15
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Shuffle Seed",
							"parameter_shortname": "Seed",
							"parameter_type": 1,
							"parameter_mmin": 0,
							"parameter_mmax": 9999,
							"parameter_unitstyle": 0,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_seed",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-183",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						576,
						1461,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-184",
					"maxclass": "newobj",
					"text": "prepend kit seed",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						576,
						1516,
						110,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-185",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						752,
						1491,
						41,
						48
					],
					"presentation": 1,
					"presentation_rect": [
						1308,
						92,
						41,
						48
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Shuffle Flip",
							"parameter_shortname": "Flip",
							"parameter_type": 0,
							"parameter_mmin": 0,
							"parameter_mmax": 100,
							"parameter_unitstyle": 5,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_flip"
				}
			},
			{
				"box": {
					"id": "obj-186",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						752,
						1461,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-187",
					"maxclass": "newobj",
					"text": "prepend kit flip",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						752,
						1549,
						110,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-188",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						928,
						1491,
						36,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						1548,
						64,
						36,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Kit Undo",
							"parameter_shortname": "Undo",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_undo",
					"mode": 0,
					"text": "Undo",
					"texton": "Undo",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-189",
					"maxclass": "newobj",
					"text": "route bang 1",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						""
					],
					"patching_rect": [
						928,
						1517,
						86,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-190",
					"maxclass": "message",
					"text": "kit undo",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						928,
						1545,
						62,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-191",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						1104,
						1491,
						36,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						1588,
						64,
						36,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Kit Redo",
							"parameter_shortname": "Redo",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_redo",
					"mode": 0,
					"text": "Redo",
					"texton": "Redo",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-192",
					"maxclass": "newobj",
					"text": "route bang 1",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						""
					],
					"patching_rect": [
						1104,
						1517,
						86,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-193",
					"maxclass": "message",
					"text": "kit redo",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1104,
						1545,
						62,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-194",
					"maxclass": "live.numbox",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						1280,
						1491,
						40,
						15
					],
					"presentation": 1,
					"presentation_rect": [
						1402,
						105,
						40,
						15
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Find Best N",
							"parameter_shortname": "Best N",
							"parameter_type": 1,
							"parameter_mmin": 4,
							"parameter_mmax": 64,
							"parameter_unitstyle": 0,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_bestn",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-195",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1280,
						1461,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-196",
					"maxclass": "newobj",
					"text": "prepend kit bestn",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1280,
						1516,
						116,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-197",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						1456,
						1491,
						60,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1446,
						103,
						60,
						18
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Kit Find Best",
							"parameter_shortname": "Find best",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_best",
					"mode": 0,
					"text": "Find best",
					"texton": "Find best",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-198",
					"maxclass": "newobj",
					"text": "route bang 1",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						""
					],
					"patching_rect": [
						1456,
						1519,
						86,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-199",
					"maxclass": "message",
					"text": "kit findbest",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1456,
						1547,
						86,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-200",
					"maxclass": "live.tab",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						400,
						1649,
						84,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1402,
						139,
						84,
						18
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Choke Scope",
							"parameter_shortname": "Choke",
							"parameter_type": 2,
							"parameter_enum": [
								"Sample",
								"All"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_chokescope",
					"num_lines_patching": 1,
					"num_lines_presentation": 1,
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-201",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						1619,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-202",
					"maxclass": "newobj",
					"text": "prepend kit chokescope",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						1677,
						146,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-203",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						576,
						1649,
						44,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						1516,
						103,
						44,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Mod Zone",
							"parameter_shortname": "Mods",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_modzone",
					"mode": 1,
					"text": "Mods",
					"texton": "Mods",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-204",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						576,
						1619,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-205",
					"maxclass": "newobj",
					"text": "prepend kit modzone",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						576,
						1675,
						128,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-206",
					"maxclass": "live.numbox",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						752,
						1649,
						40,
						15
					],
					"presentation": 1,
					"presentation_rect": [
						1564,
						105,
						40,
						15
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Mod Zone Start",
							"parameter_shortname": "Mod Start",
							"parameter_type": 1,
							"parameter_mmin": 0,
							"parameter_mmax": 112,
							"parameter_unitstyle": 8,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_modstart",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-207",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						752,
						1619,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-208",
					"maxclass": "newobj",
					"text": "prepend kit modstart",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						752,
						1674,
						134,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-209",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						928,
						1649,
						41,
						48
					],
					"presentation": 1,
					"presentation_rect": [
						1352,
						92,
						41,
						48
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Velocity Sens",
							"parameter_shortname": "Vel",
							"parameter_type": 0,
							"parameter_mmin": 0,
							"parameter_mmax": 100,
							"parameter_unitstyle": 5,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_velsens"
				}
			},
			{
				"box": {
					"id": "obj-210",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						928,
						1619,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-211",
					"maxclass": "newobj",
					"text": "prepend kit velsens",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						928,
						1707,
						128,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-212",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						1104,
						1649,
						44,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						1492,
						139,
						44,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pressure To Level",
							"parameter_shortname": "Press",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pressure",
					"mode": 1,
					"text": "Press",
					"texton": "Press",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-213",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1104,
						1619,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-214",
					"maxclass": "newobj",
					"text": "prepend kit pressure2level",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1104,
						1675,
						170,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-215",
					"maxclass": "comment",
					"text": "MORPH / SCAN / CAPTURE / CLIP  - kit|pad <param>   (feedback kit_* -> prepend set; Folder... is in the INPUTS column)",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						400,
						1801,
						640,
						20
					]
				}
			},
			{
				"box": {
					"id": "obj-216",
					"maxclass": "newobj",
					"text": "route kit_morphedit kit_capturebars kit_keepclip",
					"numinlets": 1,
					"numoutlets": 4,
					"outlettype": [
						"",
						"",
						"",
						""
					],
					"patching_rect": [
						400,
						1827,
						1216,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-217",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						400,
						1905,
						41,
						48
					],
					"presentation": 1,
					"presentation_rect": [
						1826,
						19,
						41,
						48
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Morph",
							"parameter_shortname": "Morph",
							"parameter_type": 0,
							"parameter_mmin": 0,
							"parameter_mmax": 100,
							"parameter_unitstyle": 5,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								0
							],
							"parameter_invisible": 0
						}
					},
					"varname": "sk_morph"
				}
			},
			{
				"box": {
					"id": "obj-218",
					"maxclass": "newobj",
					"text": "prepend kit morph",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						1963,
						116,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-219",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						576,
						1905,
						41,
						48
					],
					"presentation": 1,
					"presentation_rect": [
						1870,
						19,
						41,
						48
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Scan",
							"parameter_shortname": "Scan",
							"parameter_type": 0,
							"parameter_mmin": 0,
							"parameter_mmax": 100,
							"parameter_unitstyle": 5,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								0
							],
							"parameter_invisible": 0
						}
					},
					"varname": "sk_scan"
				}
			},
			{
				"box": {
					"id": "obj-220",
					"maxclass": "newobj",
					"text": "prepend kit scan",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						576,
						1963,
						110,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-221",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						752,
						1905,
						70,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1918,
						21,
						70,
						18
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Morph Edit B",
							"parameter_shortname": "Edit B",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_morphedit",
					"mode": 1,
					"text": "Edit B",
					"texton": "Edit B",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-222",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						752,
						1875,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-223",
					"maxclass": "newobj",
					"text": "prepend kit morphedit",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						752,
						1933,
						140,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-224",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						928,
						1905,
						80,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						1826,
						72,
						80,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Morph Copy A To B",
							"parameter_shortname": "A→B",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_morphcopy",
					"mode": 0,
					"text": "A→B",
					"texton": "A→B",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-225",
					"maxclass": "newobj",
					"text": "route bang 1",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						""
					],
					"patching_rect": [
						928,
						1931,
						86,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-226",
					"maxclass": "message",
					"text": "pad morphcopy",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						928,
						1959,
						92,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-227",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						1104,
						1905,
						80,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						1910,
						72,
						80,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Morph Clear B",
							"parameter_shortname": "Clr B",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_morphclear",
					"mode": 0,
					"text": "Clr B",
					"texton": "Clr B",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-228",
					"maxclass": "newobj",
					"text": "route bang 1",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						""
					],
					"patching_rect": [
						1104,
						1931,
						86,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-229",
					"maxclass": "message",
					"text": "pad morphclear",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1104,
						1959,
						98,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-230",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						1280,
						1905,
						80,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						1826,
						92,
						80,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Morph Copy All A To B",
							"parameter_shortname": "All A→B",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_morphcopyall",
					"mode": 0,
					"text": "All A→B",
					"texton": "All A→B",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-231",
					"maxclass": "newobj",
					"text": "route bang 1",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						""
					],
					"patching_rect": [
						1280,
						1931,
						86,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-232",
					"maxclass": "message",
					"text": "kit morphcopyall",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1280,
						1959,
						110,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-233",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						1456,
						1905,
						80,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						1910,
						92,
						80,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Morph Clear All B",
							"parameter_shortname": "All Clr B",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_morphclearall",
					"mode": 0,
					"text": "All Clr B",
					"texton": "All Clr B",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-234",
					"maxclass": "newobj",
					"text": "route bang 1",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						""
					],
					"patching_rect": [
						1456,
						1931,
						86,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-235",
					"maxclass": "message",
					"text": "kit morphclearall",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1456,
						1959,
						116,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-236",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						400,
						2063,
						52,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1826,
						137,
						52,
						18
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Capture",
							"parameter_shortname": "Capture",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_capture",
					"mode": 0,
					"text": "Capture",
					"texton": "Capture",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-237",
					"maxclass": "newobj",
					"text": "route bang 1",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						""
					],
					"patching_rect": [
						400,
						2091,
						86,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-238",
					"maxclass": "message",
					"text": "kit capture",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						2119,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-239",
					"maxclass": "live.menu",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						576,
						2063,
						58,
						17
					],
					"presentation": 1,
					"presentation_rect": [
						1882,
						137,
						58,
						17
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Capture Length",
							"parameter_shortname": "Cap Bars",
							"parameter_type": 2,
							"parameter_enum": [
								"1/2 Bar",
								"1 Bar",
								"2 Bars",
								"4 Bars",
								"8 Bars"
							],
							"parameter_mmax": 4,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_capturebars",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-240",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						576,
						2033,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-241",
					"maxclass": "newobj",
					"text": "prepend kit capturebars",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						576,
						2090,
						152,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-242",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						752,
						2063,
						84,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						1642,
						141,
						84,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Keep Clip",
							"parameter_shortname": "Keep clip",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_keepclip",
					"mode": 1,
					"text": "Keep clip",
					"texton": "Keep clip",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-243",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						752,
						2033,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-244",
					"maxclass": "newobj",
					"text": "prepend kit keepclip",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						752,
						2089,
						134,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-245",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						928,
						2063,
						80,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						1730,
						141,
						80,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Remap Clip",
							"parameter_shortname": "Remap clip",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_remapclip",
					"mode": 0,
					"text": "Remap clip",
					"texton": "Remap clip",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-246",
					"maxclass": "newobj",
					"text": "route bang 1",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						""
					],
					"patching_rect": [
						928,
						2089,
						86,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-247",
					"maxclass": "message",
					"text": "kit remapclip",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						928,
						2117,
						92,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-248",
					"maxclass": "comment",
					"text": "GESTURE  - gest <param>   (feedback gest_* -> prepend set)",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						400,
						2185,
						640,
						20
					]
				}
			},
			{
				"box": {
					"id": "obj-249",
					"maxclass": "newobj",
					"text": "route gest_sel gest_beats gest_ratefrom gest_rateto gest_cutfrom gest_cutto gest_pitchfrom gest_pitchto gest_ampfrom gest_ampto gest_curve",
					"numinlets": 1,
					"numoutlets": 12,
					"outlettype": [
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						""
					],
					"patching_rect": [
						400,
						2211,
						1216,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-250",
					"maxclass": "live.tab",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						400,
						2289,
						100,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						2006,
						32,
						100,
						18
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Gesture Select",
							"parameter_shortname": "Gesture",
							"parameter_type": 2,
							"parameter_enum": [
								"1",
								"2",
								"3",
								"4"
							],
							"parameter_mmax": 3,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_gest_sel",
					"num_lines_patching": 1,
					"num_lines_presentation": 1,
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-251",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						2259,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-252",
					"maxclass": "newobj",
					"text": "prepend gest sel",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						2317,
						110,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-253",
					"maxclass": "live.menu",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						576,
						2289,
						68,
						17
					],
					"presentation": 1,
					"presentation_rect": [
						2110,
						32,
						68,
						17
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Gesture Length",
							"parameter_shortname": "Length",
							"parameter_type": 2,
							"parameter_enum": [
								"1/16 bar",
								"1/8 bar",
								"1 beat",
								"2 beats",
								"1 bar",
								"2 bars",
								"4 bars"
							],
							"parameter_mmax": 6,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_gest_beats",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-254",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						576,
						2259,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-255",
					"maxclass": "newobj",
					"text": "prepend gest beats",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						576,
						2316,
						122,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-256",
					"maxclass": "live.menu",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						752,
						2289,
						62,
						17
					],
					"presentation": 1,
					"presentation_rect": [
						2182,
						32,
						62,
						17
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Gesture Rate From",
							"parameter_shortname": "Rate From",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"1/4",
								"1/8",
								"1/8T",
								"1/16",
								"1/16T",
								"1/32",
								"1/32T",
								"1/64"
							],
							"parameter_mmax": 8,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_gest_ratefrom",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-257",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						752,
						2259,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-258",
					"maxclass": "newobj",
					"text": "prepend gest ratefrom",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						752,
						2316,
						140,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-259",
					"maxclass": "live.menu",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						928,
						2289,
						62,
						17
					],
					"presentation": 1,
					"presentation_rect": [
						2248,
						32,
						62,
						17
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Gesture Rate To",
							"parameter_shortname": "Rate To",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"1/4",
								"1/8",
								"1/8T",
								"1/16",
								"1/16T",
								"1/32",
								"1/32T",
								"1/64"
							],
							"parameter_mmax": 8,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_gest_rateto",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-260",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						928,
						2259,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-261",
					"maxclass": "newobj",
					"text": "prepend gest rateto",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						928,
						2316,
						128,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-262",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						1104,
						2289,
						41,
						48
					],
					"presentation": 1,
					"presentation_rect": [
						2006,
						70,
						41,
						48
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Gesture Cutoff From",
							"parameter_shortname": "From",
							"parameter_type": 0,
							"parameter_mmin": 20,
							"parameter_mmax": 20000,
							"parameter_unitstyle": 3,
							"parameter_exponent": 3,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_gest_cutfrom"
				}
			},
			{
				"box": {
					"id": "obj-263",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1104,
						2259,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-264",
					"maxclass": "newobj",
					"text": "prepend gest cutfrom",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1104,
						2347,
						134,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-265",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						1280,
						2289,
						41,
						48
					],
					"presentation": 1,
					"presentation_rect": [
						2049,
						70,
						41,
						48
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Gesture Cutoff To",
							"parameter_shortname": "To",
							"parameter_type": 0,
							"parameter_mmin": 20,
							"parameter_mmax": 20000,
							"parameter_unitstyle": 3,
							"parameter_exponent": 3,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_gest_cutto"
				}
			},
			{
				"box": {
					"id": "obj-266",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1280,
						2259,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-267",
					"maxclass": "newobj",
					"text": "prepend gest cutto",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1280,
						2347,
						122,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-268",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						1456,
						2289,
						41,
						48
					],
					"presentation": 1,
					"presentation_rect": [
						2096,
						70,
						41,
						48
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Gesture Pitch From",
							"parameter_shortname": "From",
							"parameter_type": 1,
							"parameter_mmin": -48,
							"parameter_mmax": 48,
							"parameter_unitstyle": 7,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_gest_pitchfrom"
				}
			},
			{
				"box": {
					"id": "obj-269",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1456,
						2259,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-270",
					"maxclass": "newobj",
					"text": "prepend gest pitchfrom",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1456,
						2347,
						146,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-271",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						400,
						2447,
						41,
						48
					],
					"presentation": 1,
					"presentation_rect": [
						2139,
						70,
						41,
						48
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Gesture Pitch To",
							"parameter_shortname": "To",
							"parameter_type": 1,
							"parameter_mmin": -48,
							"parameter_mmax": 48,
							"parameter_unitstyle": 7,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_gest_pitchto"
				}
			},
			{
				"box": {
					"id": "obj-272",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						2417,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-273",
					"maxclass": "newobj",
					"text": "prepend gest pitchto",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						2505,
						134,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-274",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						576,
						2447,
						41,
						48
					],
					"presentation": 1,
					"presentation_rect": [
						2186,
						70,
						41,
						48
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Gesture Amp From",
							"parameter_shortname": "From",
							"parameter_type": 0,
							"parameter_mmin": 0,
							"parameter_mmax": 100,
							"parameter_unitstyle": 5,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_gest_ampfrom"
				}
			},
			{
				"box": {
					"id": "obj-275",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						576,
						2417,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-276",
					"maxclass": "newobj",
					"text": "prepend gest ampfrom",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						576,
						2505,
						134,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-277",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						752,
						2447,
						41,
						48
					],
					"presentation": 1,
					"presentation_rect": [
						2229,
						70,
						41,
						48
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Gesture Amp To",
							"parameter_shortname": "To",
							"parameter_type": 0,
							"parameter_mmin": 0,
							"parameter_mmax": 100,
							"parameter_unitstyle": 5,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_gest_ampto"
				}
			},
			{
				"box": {
					"id": "obj-278",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						752,
						2417,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-279",
					"maxclass": "newobj",
					"text": "prepend gest ampto",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						752,
						2505,
						122,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-280",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						928,
						2447,
						41,
						48
					],
					"presentation": 1,
					"presentation_rect": [
						2276,
						70,
						41,
						48
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Gesture Curve",
							"parameter_shortname": "Curve",
							"parameter_type": 0,
							"parameter_mmin": 0,
							"parameter_mmax": 100,
							"parameter_unitstyle": 5,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_gest_curve"
				}
			},
			{
				"box": {
					"id": "obj-281",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						928,
						2417,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-282",
					"maxclass": "newobj",
					"text": "prepend gest curve",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						928,
						2505,
						122,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-283",
					"maxclass": "comment",
					"text": "GLUE  outlet 0 -> poly~ | 1 -> buffers | 2 -> feedback routes | 3 -> jsui | 4 -> capture recorder",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						400,
						2603,
						620,
						20
					]
				}
			},
			{
				"box": {
					"id": "obj-284",
					"maxclass": "jsui",
					"filename": "slicekit-ui.js",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"parameter_enable": 0,
					"patching_rect": [
						820,
						2665,
						170,
						90
					],
					"presentation": 1,
					"presentation_rect": [
						90,
						3,
						600,
						160
					],
					"varname": "sk_ui"
				}
			},
			{
				"box": {
					"id": "obj-285",
					"maxclass": "newobj",
					"text": "prepend ui",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						820,
						2769,
						74,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-286",
					"maxclass": "comment",
					"text": "AUDIO",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						260,
						2683,
						60,
						20
					]
				}
			},
			{
				"box": {
					"id": "obj-287",
					"maxclass": "newobj",
					"text": "plugphasor~",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						"signal"
					],
					"patching_rect": [
						260,
						2707,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-288",
					"maxclass": "newobj",
					"text": "poly~ slicekit.voice 16",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"signal",
						"signal",
						""
					],
					"patching_rect": [
						400,
						2739,
						240,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-289",
					"maxclass": "live.gain~",
					"numinlets": 2,
					"numoutlets": 5,
					"outlettype": [
						"signal",
						"signal",
						"",
						"float",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						400,
						2805,
						48,
						100
					],
					"presentation": 1,
					"presentation_rect": [
						2330,
						4,
						40,
						161
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Output",
							"parameter_shortname": "Output",
							"parameter_type": 0,
							"parameter_mmin": -70,
							"parameter_mmax": 6,
							"parameter_unitstyle": 4,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								0
							],
							"parameter_invisible": 0
						}
					},
					"varname": "sk_out",
					"channels": 2
				}
			},
			{
				"box": {
					"id": "obj-290",
					"maxclass": "newobj",
					"text": "plugout~",
					"numinlets": 2,
					"numoutlets": 0,
					"patching_rect": [
						400,
						2925,
						62,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-291",
					"maxclass": "comment",
					"text": "CAPTURE  poly~ L/R (before live.gain~) -> recorder gen~ -> ring buffer ---cap; glue outlet 4 binds the buffers (cap / wpb)",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						470,
						2905,
						760,
						20
					]
				}
			},
			{
				"box": {
					"id": "obj-292",
					"maxclass": "newobj",
					"text": "gen~",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						"signal"
					],
					"patching_rect": [
						470,
						2933,
						130,
						22
					],
					"patcher": {
						"fileversion": 1,
						"appversion": {
							"major": 9,
							"minor": 0,
							"revision": 0,
							"architecture": "x64",
							"modernui": 1
						},
						"classnamespace": "dsp.gen",
						"rect": [
							60,
							90,
							760,
							710
						],
						"openinpresentation": 0,
						"default_fontsize": 12,
						"default_fontname": "Arial",
						"boxes": [
							{
								"box": {
									"id": "obj-1",
									"maxclass": "newobj",
									"text": "in 1",
									"numinlets": 0,
									"numoutlets": 1,
									"outlettype": [
										""
									],
									"patching_rect": [
										30,
										20,
										40,
										22
									]
								}
							},
							{
								"box": {
									"id": "obj-2",
									"maxclass": "newobj",
									"text": "in 2",
									"numinlets": 0,
									"numoutlets": 1,
									"outlettype": [
										""
									],
									"patching_rect": [
										120,
										20,
										40,
										22
									]
								}
							},
							{
								"box": {
									"id": "obj-3",
									"maxclass": "codebox",
									"code": "// SliceKit recorder - gen~ codebox (GenExpr)\n// ======================================================================\n// Records the device output (stereo) continuously into a ring buffer~ so the\n// glue can cut the last N bars out of it (\"kit capture\"). One gen~ in the\n// device patcher, fed with poly~ outlets 0/1 (before the output gain).\n// See docs/PROTOCOL.md (v2 additions: Topology, Capture flow, Recorder).\n//\n// INPUTS\n//   in1   left  signal\n//   in2   right signal\n// OUTPUT\n//   out1  write position: index of the NEXT frame that will be written\n//         (0 .. frames-1; 0 while no ring buffer is bound or it is empty)\n// BUFFERS (bound by the glue with messages sent to gen~ at init)\n//   cap <buffer~ name>   the ring buffer, 2 channels ([buffer~ ---cap 40000 2]).\n//                        Channel 0 = left, channel 1 = right.\n//   wpb <buffer~ name>   position buffer ([buffer~ ---capwp 10 1]). Frame 0,\n//                        channel 0 receives, every sample, the NEXT write\n//                        position (the same value as out1, after the advance\n//                        and wrap). So the newest frame is wp-1 (wrapped) and\n//                        the last N frames are [wp-N, wp), which is what the\n//                        glue copies when a capture is requested.\n//\n// Each sample, when the ring buffer has frames (dim(cap) > 0):\n//   poke(cap, in1, wp, 0); poke(cap, in2, wp, 1);\n//   wp advances by one and wraps to 0 at dim(cap); poke(wpb, wp, 0, 0).\n// With an empty or unbound ring buffer nothing is written and wp stays put.\n//\n// GenExpr notes (the test checks these, see docs/VOICE.md):\n//   - poke(buffer, value, index, channel): value first, then index, then channel.\n//   - The History `wp` is read once into a local at the top and written once\n//     at the end, so the code does not depend on whether a History read sees a\n//     write made in the same sample. The local is assigned at top level\n//     because GenExpr scopes variables to their {} block.\n//   - If the ring buffer is resized to fewer frames than wp, wp wraps to 0\n//     before the first write.\n\nBuffer cap;\nBuffer wpb;\n\nHistory wp(0);\n\nwpos = wp;\nnfr = dim(cap);\nif (nfr > 0) {\n  if (wpos >= nfr) {\n    wpos = 0;\n  }\n  poke(cap, in1, wpos, 0);\n  poke(cap, in2, wpos, 1);\n  wpos = wpos + 1;\n  if (wpos >= nfr) {\n    wpos = 0;\n  }\n  poke(wpb, wpos, 0, 0);\n}\nwp = wpos;\n\nout1 = wpos;\n",
									"fontface": 0,
									"fontname": "<Monospaced>",
									"fontsize": 12,
									"numinlets": 2,
									"numoutlets": 1,
									"outlettype": [
										""
									],
									"patching_rect": [
										30,
										56,
										640,
										520
									]
								}
							},
							{
								"box": {
									"id": "obj-4",
									"maxclass": "newobj",
									"text": "out 1",
									"numinlets": 1,
									"numoutlets": 0,
									"patching_rect": [
										30,
										600,
										46,
										22
									]
								}
							}
						],
						"lines": [
							{
								"patchline": {
									"source": [
										"obj-1",
										0
									],
									"destination": [
										"obj-3",
										0
									]
								}
							},
							{
								"patchline": {
									"source": [
										"obj-2",
										0
									],
									"destination": [
										"obj-3",
										1
									]
								}
							},
							{
								"patchline": {
									"source": [
										"obj-3",
										0
									],
									"destination": [
										"obj-4",
										0
									]
								}
							}
						],
						"originid": "pat-1"
					},
					"saved_object_attributes": {
						"globalpatchername": ""
					}
				}
			},
			{
				"box": {
					"id": "obj-293",
					"maxclass": "newobj",
					"text": "buffer~ ---cap 40000 2",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"float",
						"bang"
					],
					"patching_rect": [
						630,
						2933,
						146,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-294",
					"maxclass": "newobj",
					"text": "buffer~ ---capwp 10 1",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"float",
						"bang"
					],
					"patching_rect": [
						800,
						2933,
						140,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-295",
					"maxclass": "newobj",
					"text": "buffer~ ---capout 1000 2",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"float",
						"bang"
					],
					"patching_rect": [
						960,
						2933,
						158,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-296",
					"maxclass": "comment",
					"text": "ring 40 s stereo",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						630,
						2961,
						140,
						20
					]
				}
			},
			{
				"box": {
					"id": "obj-297",
					"maxclass": "comment",
					"text": "write position (frame 0)",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						800,
						2961,
						150,
						20
					]
				}
			},
			{
				"box": {
					"id": "obj-298",
					"maxclass": "comment",
					"text": "export staging (.wav)",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						960,
						2961,
						150,
						20
					]
				}
			},
			{
				"box": {
					"id": "obj-299",
					"maxclass": "comment",
					"text": "STATE (saved with the Live Set) / VIEW MODEL (jsui)",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						470,
						2805,
						360,
						20
					]
				}
			},
			{
				"box": {
					"id": "obj-300",
					"maxclass": "newobj",
					"text": "dict ---skstate @parameter_enable 1",
					"numinlets": 2,
					"numoutlets": 4,
					"outlettype": [
						"dictionary",
						"",
						"",
						"bang"
					],
					"patching_rect": [
						470,
						2829,
						224,
						22
					],
					"parameter_enable": 1,
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "SliceKit State",
							"parameter_shortname": "State",
							"parameter_type": 3,
							"parameter_invisible": 1
						}
					},
					"varname": "sk_state"
				}
			},
			{
				"box": {
					"id": "obj-301",
					"maxclass": "newobj",
					"text": "dict ---skview",
					"numinlets": 2,
					"numoutlets": 4,
					"outlettype": [
						"dictionary",
						"",
						"",
						"bang"
					],
					"patching_rect": [
						470,
						2861,
						98,
						22
					],
					"varname": "sk_view"
				}
			},
			{
				"box": {
					"id": "obj-302",
					"maxclass": "comment",
					"text": "BUFFERS  glue outlet 1:  <i> replace <path> | <i> clear   -  right outlet of buffer~ -> loaded <i>",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1060,
						2665,
						700,
						20
					]
				}
			},
			{
				"box": {
					"id": "obj-303",
					"maxclass": "newobj",
					"text": "route 0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15",
					"numinlets": 1,
					"numoutlets": 17,
					"outlettype": [
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						""
					],
					"patching_rect": [
						1060,
						2691,
						1798,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-304",
					"maxclass": "newobj",
					"text": "buffer~ ---src0",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"float",
						"bang"
					],
					"patching_rect": [
						1060,
						2741,
						104,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-305",
					"maxclass": "newobj",
					"text": "t b",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						"bang"
					],
					"patching_rect": [
						1060,
						2781,
						32,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-306",
					"maxclass": "message",
					"text": "loaded 0",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1060,
						2817,
						62,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-307",
					"maxclass": "newobj",
					"text": "buffer~ ---src1",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"float",
						"bang"
					],
					"patching_rect": [
						1172,
						2741,
						104,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-308",
					"maxclass": "newobj",
					"text": "t b",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						"bang"
					],
					"patching_rect": [
						1172,
						2781,
						32,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-309",
					"maxclass": "message",
					"text": "loaded 1",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1172,
						2817,
						62,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-310",
					"maxclass": "newobj",
					"text": "buffer~ ---src2",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"float",
						"bang"
					],
					"patching_rect": [
						1284,
						2741,
						104,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-311",
					"maxclass": "newobj",
					"text": "t b",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						"bang"
					],
					"patching_rect": [
						1284,
						2781,
						32,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-312",
					"maxclass": "message",
					"text": "loaded 2",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1284,
						2817,
						62,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-313",
					"maxclass": "newobj",
					"text": "buffer~ ---src3",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"float",
						"bang"
					],
					"patching_rect": [
						1396,
						2741,
						104,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-314",
					"maxclass": "newobj",
					"text": "t b",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						"bang"
					],
					"patching_rect": [
						1396,
						2781,
						32,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-315",
					"maxclass": "message",
					"text": "loaded 3",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1396,
						2817,
						62,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-316",
					"maxclass": "newobj",
					"text": "buffer~ ---src4",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"float",
						"bang"
					],
					"patching_rect": [
						1508,
						2741,
						104,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-317",
					"maxclass": "newobj",
					"text": "t b",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						"bang"
					],
					"patching_rect": [
						1508,
						2781,
						32,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-318",
					"maxclass": "message",
					"text": "loaded 4",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1508,
						2817,
						62,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-319",
					"maxclass": "newobj",
					"text": "buffer~ ---src5",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"float",
						"bang"
					],
					"patching_rect": [
						1620,
						2741,
						104,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-320",
					"maxclass": "newobj",
					"text": "t b",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						"bang"
					],
					"patching_rect": [
						1620,
						2781,
						32,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-321",
					"maxclass": "message",
					"text": "loaded 5",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1620,
						2817,
						62,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-322",
					"maxclass": "newobj",
					"text": "buffer~ ---src6",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"float",
						"bang"
					],
					"patching_rect": [
						1732,
						2741,
						104,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-323",
					"maxclass": "newobj",
					"text": "t b",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						"bang"
					],
					"patching_rect": [
						1732,
						2781,
						32,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-324",
					"maxclass": "message",
					"text": "loaded 6",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1732,
						2817,
						62,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-325",
					"maxclass": "newobj",
					"text": "buffer~ ---src7",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"float",
						"bang"
					],
					"patching_rect": [
						1844,
						2741,
						104,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-326",
					"maxclass": "newobj",
					"text": "t b",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						"bang"
					],
					"patching_rect": [
						1844,
						2781,
						32,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-327",
					"maxclass": "message",
					"text": "loaded 7",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1844,
						2817,
						62,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-328",
					"maxclass": "newobj",
					"text": "buffer~ ---src8",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"float",
						"bang"
					],
					"patching_rect": [
						1956,
						2741,
						104,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-329",
					"maxclass": "newobj",
					"text": "t b",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						"bang"
					],
					"patching_rect": [
						1956,
						2781,
						32,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-330",
					"maxclass": "message",
					"text": "loaded 8",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1956,
						2817,
						62,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-331",
					"maxclass": "newobj",
					"text": "buffer~ ---src9",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"float",
						"bang"
					],
					"patching_rect": [
						2068,
						2741,
						104,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-332",
					"maxclass": "newobj",
					"text": "t b",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						"bang"
					],
					"patching_rect": [
						2068,
						2781,
						32,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-333",
					"maxclass": "message",
					"text": "loaded 9",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						2068,
						2817,
						62,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-334",
					"maxclass": "newobj",
					"text": "buffer~ ---src10",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"float",
						"bang"
					],
					"patching_rect": [
						2180,
						2741,
						110,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-335",
					"maxclass": "newobj",
					"text": "t b",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						"bang"
					],
					"patching_rect": [
						2180,
						2781,
						32,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-336",
					"maxclass": "message",
					"text": "loaded 10",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						2180,
						2817,
						68,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-337",
					"maxclass": "newobj",
					"text": "buffer~ ---src11",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"float",
						"bang"
					],
					"patching_rect": [
						2292,
						2741,
						110,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-338",
					"maxclass": "newobj",
					"text": "t b",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						"bang"
					],
					"patching_rect": [
						2292,
						2781,
						32,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-339",
					"maxclass": "message",
					"text": "loaded 11",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						2292,
						2817,
						68,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-340",
					"maxclass": "newobj",
					"text": "buffer~ ---src12",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"float",
						"bang"
					],
					"patching_rect": [
						2404,
						2741,
						110,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-341",
					"maxclass": "newobj",
					"text": "t b",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						"bang"
					],
					"patching_rect": [
						2404,
						2781,
						32,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-342",
					"maxclass": "message",
					"text": "loaded 12",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						2404,
						2817,
						68,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-343",
					"maxclass": "newobj",
					"text": "buffer~ ---src13",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"float",
						"bang"
					],
					"patching_rect": [
						2516,
						2741,
						110,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-344",
					"maxclass": "newobj",
					"text": "t b",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						"bang"
					],
					"patching_rect": [
						2516,
						2781,
						32,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-345",
					"maxclass": "message",
					"text": "loaded 13",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						2516,
						2817,
						68,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-346",
					"maxclass": "newobj",
					"text": "buffer~ ---src14",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"float",
						"bang"
					],
					"patching_rect": [
						2628,
						2741,
						110,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-347",
					"maxclass": "newobj",
					"text": "t b",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						"bang"
					],
					"patching_rect": [
						2628,
						2781,
						32,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-348",
					"maxclass": "message",
					"text": "loaded 14",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						2628,
						2817,
						68,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-349",
					"maxclass": "newobj",
					"text": "buffer~ ---src15",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"float",
						"bang"
					],
					"patching_rect": [
						2740,
						2741,
						110,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-350",
					"maxclass": "newobj",
					"text": "t b",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						"bang"
					],
					"patching_rect": [
						2740,
						2781,
						32,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-351",
					"maxclass": "message",
					"text": "loaded 15",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						2740,
						2817,
						68,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-352",
					"maxclass": "comment",
					"text": "PRESENTATION-ONLY: panels, section titles, labels (no function)",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1680,
						14,
						420,
						20
					]
				}
			},
			{
				"box": {
					"id": "obj-353",
					"maxclass": "panel",
					"background": 1,
					"border": 1,
					"rounded": 8,
					"mode": 0,
					"bgcolor": [
						0.5,
						0.5,
						0.5,
						0.1
					],
					"bordercolor": [
						0.5,
						0.5,
						0.5,
						0.28
					],
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1680,
						44,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						2,
						2,
						84,
						165
					]
				}
			},
			{
				"box": {
					"id": "obj-354",
					"maxclass": "panel",
					"background": 1,
					"border": 1,
					"rounded": 8,
					"mode": 0,
					"bgcolor": [
						0.5,
						0.5,
						0.5,
						0.1
					],
					"bordercolor": [
						0.5,
						0.5,
						0.5,
						0.28
					],
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1820,
						44,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						694,
						2,
						244,
						165
					]
				}
			},
			{
				"box": {
					"id": "obj-355",
					"maxclass": "panel",
					"background": 1,
					"border": 1,
					"rounded": 8,
					"mode": 0,
					"bgcolor": [
						0.5,
						0.5,
						0.5,
						0.1
					],
					"bordercolor": [
						0.5,
						0.5,
						0.5,
						0.28
					],
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1960,
						44,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						942,
						2,
						356,
						165
					]
				}
			},
			{
				"box": {
					"id": "obj-356",
					"maxclass": "panel",
					"background": 1,
					"border": 1,
					"rounded": 8,
					"mode": 0,
					"bgcolor": [
						0.5,
						0.5,
						0.5,
						0.1
					],
					"bordercolor": [
						0.5,
						0.5,
						0.5,
						0.28
					],
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1680,
						68,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1302,
						2,
						330,
						165
					]
				}
			},
			{
				"box": {
					"id": "obj-357",
					"maxclass": "panel",
					"background": 1,
					"border": 1,
					"rounded": 8,
					"mode": 0,
					"bgcolor": [
						0.5,
						0.5,
						0.5,
						0.1
					],
					"bordercolor": [
						0.5,
						0.5,
						0.5,
						0.28
					],
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1820,
						68,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1636,
						2,
						180,
						165
					]
				}
			},
			{
				"box": {
					"id": "obj-358",
					"maxclass": "panel",
					"background": 1,
					"border": 1,
					"rounded": 8,
					"mode": 0,
					"bgcolor": [
						0.5,
						0.5,
						0.5,
						0.1
					],
					"bordercolor": [
						0.5,
						0.5,
						0.5,
						0.28
					],
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1960,
						68,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1820,
						2,
						176,
						110
					]
				}
			},
			{
				"box": {
					"id": "obj-359",
					"maxclass": "panel",
					"background": 1,
					"border": 1,
					"rounded": 8,
					"mode": 0,
					"bgcolor": [
						0.5,
						0.5,
						0.5,
						0.1
					],
					"bordercolor": [
						0.5,
						0.5,
						0.5,
						0.28
					],
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1680,
						92,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1820,
						114,
						176,
						53
					]
				}
			},
			{
				"box": {
					"id": "obj-360",
					"maxclass": "panel",
					"background": 1,
					"border": 1,
					"rounded": 8,
					"mode": 0,
					"bgcolor": [
						0.5,
						0.5,
						0.5,
						0.1
					],
					"bordercolor": [
						0.5,
						0.5,
						0.5,
						0.28
					],
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1820,
						92,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						2000,
						2,
						322,
						165
					]
				}
			},
			{
				"box": {
					"id": "obj-361",
					"maxclass": "panel",
					"background": 1,
					"border": 1,
					"rounded": 8,
					"mode": 0,
					"bgcolor": [
						0.5,
						0.5,
						0.5,
						0.1
					],
					"bordercolor": [
						0.5,
						0.5,
						0.5,
						0.28
					],
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1960,
						92,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						2326,
						2,
						48,
						165
					]
				}
			},
			{
				"box": {
					"id": "obj-362",
					"maxclass": "live.comment",
					"text": "DROP SAMPLES",
					"fontsize": 10,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1680,
						116,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						8,
						4,
						72,
						13
					]
				}
			},
			{
				"box": {
					"id": "obj-363",
					"maxclass": "live.comment",
					"text": "SAMPLE",
					"fontsize": 10,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1820,
						116,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						700,
						4,
						232,
						13
					]
				}
			},
			{
				"box": {
					"id": "obj-364",
					"maxclass": "live.comment",
					"text": "PAD",
					"fontsize": 10,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1960,
						116,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						948,
						4,
						344,
						13
					]
				}
			},
			{
				"box": {
					"id": "obj-365",
					"maxclass": "live.comment",
					"text": "KIT",
					"fontsize": 10,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1680,
						140,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1308,
						4,
						318,
						13
					]
				}
			},
			{
				"box": {
					"id": "obj-366",
					"maxclass": "live.comment",
					"text": "PERFORM",
					"fontsize": 10,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1820,
						140,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1642,
						4,
						168,
						13
					]
				}
			},
			{
				"box": {
					"id": "obj-367",
					"maxclass": "live.comment",
					"text": "MORPH / SCAN",
					"fontsize": 10,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1960,
						140,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1826,
						4,
						164,
						13
					]
				}
			},
			{
				"box": {
					"id": "obj-368",
					"maxclass": "live.comment",
					"text": "CAPTURE",
					"fontsize": 10,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1680,
						164,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1826,
						116,
						164,
						13
					]
				}
			},
			{
				"box": {
					"id": "obj-369",
					"maxclass": "live.comment",
					"text": "GESTURE",
					"fontsize": 10,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1820,
						164,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						2006,
						4,
						310,
						13
					]
				}
			},
			{
				"box": {
					"id": "obj-370",
					"maxclass": "live.comment",
					"text": "Slice by",
					"fontsize": 9,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1960,
						164,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						700,
						64,
						78,
						12
					]
				}
			},
			{
				"box": {
					"id": "obj-371",
					"maxclass": "live.comment",
					"text": "Beat div",
					"fontsize": 9,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1680,
						188,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						782,
						64,
						58,
						12
					]
				}
			},
			{
				"box": {
					"id": "obj-372",
					"maxclass": "live.comment",
					"text": "Regions",
					"fontsize": 9,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1820,
						188,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						844,
						64,
						44,
						12
					]
				}
			},
			{
				"box": {
					"id": "obj-373",
					"maxclass": "live.comment",
					"text": "BPM",
					"fontsize": 9,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1960,
						188,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						700,
						106,
						40,
						12
					]
				}
			},
			{
				"box": {
					"id": "obj-374",
					"maxclass": "live.comment",
					"text": "Min ms",
					"fontsize": 9,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1680,
						212,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						744,
						106,
						40,
						12
					]
				}
			},
			{
				"box": {
					"id": "obj-375",
					"maxclass": "live.comment",
					"text": "Spread",
					"fontsize": 9,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1820,
						212,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1126,
						68,
						54,
						12
					]
				}
			},
			{
				"box": {
					"id": "obj-376",
					"maxclass": "live.comment",
					"text": "Count",
					"fontsize": 9,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1960,
						212,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1184,
						68,
						38,
						12
					]
				}
			},
			{
				"box": {
					"id": "obj-377",
					"maxclass": "live.comment",
					"text": "Step",
					"fontsize": 9,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1680,
						236,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1226,
						68,
						38,
						12
					]
				}
			},
			{
				"box": {
					"id": "obj-378",
					"maxclass": "live.comment",
					"text": "Arrange",
					"fontsize": 9,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1820,
						236,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1308,
						18,
						70,
						12
					]
				}
			},
			{
				"box": {
					"id": "obj-379",
					"maxclass": "live.comment",
					"text": "Sort by",
					"fontsize": 9,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1960,
						236,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1382,
						18,
						56,
						12
					]
				}
			},
			{
				"box": {
					"id": "obj-380",
					"maxclass": "live.comment",
					"text": "Root",
					"fontsize": 9,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1680,
						260,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1480,
						18,
						40,
						12
					]
				}
			},
			{
				"box": {
					"id": "obj-381",
					"maxclass": "live.comment",
					"text": "Seed",
					"fontsize": 9,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1820,
						260,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1504,
						50,
						40,
						12
					]
				}
			},
			{
				"box": {
					"id": "obj-382",
					"maxclass": "live.comment",
					"text": "Best N",
					"fontsize": 9,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1960,
						260,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1402,
						92,
						40,
						12
					]
				}
			},
			{
				"box": {
					"id": "obj-383",
					"maxclass": "live.comment",
					"text": "Mod start",
					"fontsize": 9,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1680,
						284,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1564,
						92,
						60,
						12
					]
				}
			},
			{
				"box": {
					"id": "obj-384",
					"maxclass": "live.comment",
					"text": "Choke",
					"fontsize": 9,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1820,
						284,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1402,
						126,
						50,
						12
					]
				}
			},
			{
				"box": {
					"id": "obj-385",
					"maxclass": "live.comment",
					"text": "Copy slot to",
					"fontsize": 9,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1960,
						284,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1542,
						126,
						80,
						12
					]
				}
			},
			{
				"box": {
					"id": "obj-386",
					"maxclass": "live.comment",
					"text": "Rate",
					"fontsize": 9,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1680,
						308,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1738,
						74,
						72,
						12
					]
				}
			},
			{
				"box": {
					"id": "obj-387",
					"maxclass": "live.comment",
					"text": "Rewrite clip on map change",
					"fontsize": 9,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1820,
						308,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1642,
						128,
						168,
						12
					]
				}
			},
			{
				"box": {
					"id": "obj-388",
					"maxclass": "live.comment",
					"text": "Gesture",
					"fontsize": 9,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1960,
						308,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						2006,
						19,
						100,
						12
					]
				}
			},
			{
				"box": {
					"id": "obj-389",
					"maxclass": "live.comment",
					"text": "Length",
					"fontsize": 9,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1680,
						332,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						2110,
						19,
						68,
						12
					]
				}
			},
			{
				"box": {
					"id": "obj-390",
					"maxclass": "live.comment",
					"text": "Rate from",
					"fontsize": 9,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1820,
						332,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						2182,
						19,
						62,
						12
					]
				}
			},
			{
				"box": {
					"id": "obj-391",
					"maxclass": "live.comment",
					"text": "Rate to",
					"fontsize": 9,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1960,
						332,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						2248,
						19,
						62,
						12
					]
				}
			},
			{
				"box": {
					"id": "obj-392",
					"maxclass": "live.comment",
					"text": "Cutoff",
					"fontsize": 9,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1680,
						356,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						2006,
						56,
						84,
						12
					]
				}
			},
			{
				"box": {
					"id": "obj-393",
					"maxclass": "live.comment",
					"text": "Pitch",
					"fontsize": 9,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1820,
						356,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						2096,
						56,
						84,
						12
					]
				}
			},
			{
				"box": {
					"id": "obj-394",
					"maxclass": "live.comment",
					"text": "Amp",
					"fontsize": 9,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1960,
						356,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						2186,
						56,
						84,
						12
					]
				}
			},
			{
				"box": {
					"id": "obj-395",
					"maxclass": "live.comment",
					"text": "Curve",
					"fontsize": 9,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1680,
						380,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						2276,
						56,
						41,
						12
					]
				}
			},
			{
				"box": {
					"id": "obj-396",
					"maxclass": "live.comment",
					"text": "Hold a gesture key (G1-G4 in the Mods zone): the sweep runs From -> To over Length, Curve bends the ramp.",
					"fontsize": 9,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1820,
						380,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						2006,
						126,
						310,
						36
					]
				}
			}
		],
		"lines": [
			{
				"patchline": {
					"source": [
						"obj-3",
						0
					],
					"destination": [
						"obj-4",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-4",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-6",
						0
					],
					"destination": [
						"obj-7",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-7",
						0
					],
					"destination": [
						"obj-8",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-7",
						1
					],
					"destination": [
						"obj-9",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-7",
						4
					],
					"destination": [
						"obj-10",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-8",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-9",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-10",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-12",
						0
					],
					"destination": [
						"obj-13",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-13",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-14",
						0
					],
					"destination": [
						"obj-15",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-15",
						0
					],
					"destination": [
						"obj-16",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-15",
						1
					],
					"destination": [
						"obj-16",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-16",
						0
					],
					"destination": [
						"obj-17",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-17",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-19",
						0
					],
					"destination": [
						"obj-20",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-20",
						0
					],
					"destination": [
						"obj-21",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-20",
						1
					],
					"destination": [
						"obj-21",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-21",
						0
					],
					"destination": [
						"obj-22",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-22",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-24",
						0
					],
					"destination": [
						"obj-26",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-26",
						0
					],
					"destination": [
						"obj-25",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-25",
						0
					],
					"destination": [
						"obj-27",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-27",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-24",
						1
					],
					"destination": [
						"obj-29",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-29",
						0
					],
					"destination": [
						"obj-28",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-28",
						0
					],
					"destination": [
						"obj-30",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-30",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-24",
						2
					],
					"destination": [
						"obj-32",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-32",
						0
					],
					"destination": [
						"obj-31",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-31",
						0
					],
					"destination": [
						"obj-33",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-33",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-24",
						3
					],
					"destination": [
						"obj-35",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-35",
						0
					],
					"destination": [
						"obj-34",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-34",
						0
					],
					"destination": [
						"obj-36",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-36",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-24",
						4
					],
					"destination": [
						"obj-38",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-38",
						0
					],
					"destination": [
						"obj-37",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-37",
						0
					],
					"destination": [
						"obj-39",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-39",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-24",
						5
					],
					"destination": [
						"obj-41",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-41",
						0
					],
					"destination": [
						"obj-40",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-40",
						0
					],
					"destination": [
						"obj-42",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-42",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-24",
						6
					],
					"destination": [
						"obj-44",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-44",
						0
					],
					"destination": [
						"obj-43",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-43",
						0
					],
					"destination": [
						"obj-45",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-45",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-24",
						7
					],
					"destination": [
						"obj-47",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-47",
						0
					],
					"destination": [
						"obj-46",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-46",
						0
					],
					"destination": [
						"obj-48",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-48",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-24",
						8
					],
					"destination": [
						"obj-50",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-50",
						0
					],
					"destination": [
						"obj-49",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-49",
						0
					],
					"destination": [
						"obj-51",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-51",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-52",
						0
					],
					"destination": [
						"obj-53",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-53",
						0
					],
					"destination": [
						"obj-54",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-53",
						1
					],
					"destination": [
						"obj-54",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-54",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-55",
						0
					],
					"destination": [
						"obj-56",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-56",
						0
					],
					"destination": [
						"obj-57",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-56",
						1
					],
					"destination": [
						"obj-57",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-57",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-58",
						0
					],
					"destination": [
						"obj-59",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-59",
						0
					],
					"destination": [
						"obj-60",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-59",
						1
					],
					"destination": [
						"obj-60",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-60",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-24",
						9
					],
					"destination": [
						"obj-61",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-61",
						0
					],
					"destination": [
						"obj-63",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-63",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-65",
						0
					],
					"destination": [
						"obj-67",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-67",
						0
					],
					"destination": [
						"obj-66",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-66",
						0
					],
					"destination": [
						"obj-68",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-68",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-65",
						1
					],
					"destination": [
						"obj-70",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-70",
						0
					],
					"destination": [
						"obj-69",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-69",
						0
					],
					"destination": [
						"obj-71",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-71",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-65",
						2
					],
					"destination": [
						"obj-73",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-73",
						0
					],
					"destination": [
						"obj-72",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-72",
						0
					],
					"destination": [
						"obj-74",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-74",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-65",
						3
					],
					"destination": [
						"obj-76",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-76",
						0
					],
					"destination": [
						"obj-75",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-75",
						0
					],
					"destination": [
						"obj-77",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-77",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-65",
						4
					],
					"destination": [
						"obj-79",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-79",
						0
					],
					"destination": [
						"obj-78",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-78",
						0
					],
					"destination": [
						"obj-80",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-80",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-65",
						5
					],
					"destination": [
						"obj-82",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-82",
						0
					],
					"destination": [
						"obj-81",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-81",
						0
					],
					"destination": [
						"obj-83",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-83",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-65",
						6
					],
					"destination": [
						"obj-85",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-85",
						0
					],
					"destination": [
						"obj-84",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-84",
						0
					],
					"destination": [
						"obj-86",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-86",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-65",
						7
					],
					"destination": [
						"obj-88",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-88",
						0
					],
					"destination": [
						"obj-87",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-87",
						0
					],
					"destination": [
						"obj-89",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-89",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-65",
						8
					],
					"destination": [
						"obj-91",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-91",
						0
					],
					"destination": [
						"obj-90",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-90",
						0
					],
					"destination": [
						"obj-92",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-92",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-65",
						9
					],
					"destination": [
						"obj-94",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-94",
						0
					],
					"destination": [
						"obj-93",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-93",
						0
					],
					"destination": [
						"obj-95",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-95",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-65",
						10
					],
					"destination": [
						"obj-97",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-97",
						0
					],
					"destination": [
						"obj-96",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-96",
						0
					],
					"destination": [
						"obj-98",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-98",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-65",
						11
					],
					"destination": [
						"obj-100",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-100",
						0
					],
					"destination": [
						"obj-99",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-99",
						0
					],
					"destination": [
						"obj-101",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-101",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-65",
						12
					],
					"destination": [
						"obj-103",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-103",
						0
					],
					"destination": [
						"obj-102",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-102",
						0
					],
					"destination": [
						"obj-104",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-104",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-65",
						13
					],
					"destination": [
						"obj-106",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-106",
						0
					],
					"destination": [
						"obj-105",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-105",
						0
					],
					"destination": [
						"obj-107",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-107",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-65",
						14
					],
					"destination": [
						"obj-109",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-109",
						0
					],
					"destination": [
						"obj-108",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-108",
						0
					],
					"destination": [
						"obj-110",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-110",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-111",
						0
					],
					"destination": [
						"obj-112",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-112",
						0
					],
					"destination": [
						"obj-113",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-112",
						1
					],
					"destination": [
						"obj-113",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-113",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-114",
						0
					],
					"destination": [
						"obj-115",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-115",
						0
					],
					"destination": [
						"obj-116",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-115",
						1
					],
					"destination": [
						"obj-116",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-116",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-65",
						15
					],
					"destination": [
						"obj-118",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-118",
						0
					],
					"destination": [
						"obj-117",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-117",
						0
					],
					"destination": [
						"obj-119",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-119",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-65",
						16
					],
					"destination": [
						"obj-121",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-121",
						0
					],
					"destination": [
						"obj-120",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-120",
						0
					],
					"destination": [
						"obj-122",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-122",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-65",
						17
					],
					"destination": [
						"obj-124",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-124",
						0
					],
					"destination": [
						"obj-123",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-123",
						0
					],
					"destination": [
						"obj-125",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-125",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-65",
						18
					],
					"destination": [
						"obj-127",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-127",
						0
					],
					"destination": [
						"obj-126",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-126",
						0
					],
					"destination": [
						"obj-128",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-128",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-65",
						19
					],
					"destination": [
						"obj-130",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-130",
						0
					],
					"destination": [
						"obj-129",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-129",
						0
					],
					"destination": [
						"obj-131",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-131",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-132",
						0
					],
					"destination": [
						"obj-133",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-133",
						0
					],
					"destination": [
						"obj-134",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-133",
						1
					],
					"destination": [
						"obj-134",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-134",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-135",
						0
					],
					"destination": [
						"obj-136",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-136",
						0
					],
					"destination": [
						"obj-137",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-136",
						1
					],
					"destination": [
						"obj-137",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-137",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-138",
						0
					],
					"destination": [
						"obj-139",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-139",
						0
					],
					"destination": [
						"obj-140",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-139",
						1
					],
					"destination": [
						"obj-140",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-140",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-142",
						0
					],
					"destination": [
						"obj-144",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-144",
						0
					],
					"destination": [
						"obj-143",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-143",
						0
					],
					"destination": [
						"obj-145",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-145",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-146",
						0
					],
					"destination": [
						"obj-147",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-147",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-148",
						0
					],
					"destination": [
						"obj-149",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-149",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-150",
						0
					],
					"destination": [
						"obj-151",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-151",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-152",
						0
					],
					"destination": [
						"obj-153",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-153",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-154",
						0
					],
					"destination": [
						"obj-155",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-155",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-156",
						0
					],
					"destination": [
						"obj-157",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-157",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-142",
						1
					],
					"destination": [
						"obj-159",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-159",
						0
					],
					"destination": [
						"obj-158",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-158",
						0
					],
					"destination": [
						"obj-160",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-160",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-142",
						2
					],
					"destination": [
						"obj-162",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-162",
						0
					],
					"destination": [
						"obj-161",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-161",
						0
					],
					"destination": [
						"obj-163",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-163",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-142",
						3
					],
					"destination": [
						"obj-165",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-165",
						0
					],
					"destination": [
						"obj-164",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-164",
						0
					],
					"destination": [
						"obj-166",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-166",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-142",
						4
					],
					"destination": [
						"obj-168",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-168",
						0
					],
					"destination": [
						"obj-167",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-167",
						0
					],
					"destination": [
						"obj-169",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-169",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-170",
						0
					],
					"destination": [
						"obj-171",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-171",
						0
					],
					"destination": [
						"obj-172",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-171",
						1
					],
					"destination": [
						"obj-172",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-172",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-173",
						0
					],
					"destination": [
						"obj-174",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-174",
						0
					],
					"destination": [
						"obj-175",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-174",
						1
					],
					"destination": [
						"obj-175",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-175",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-142",
						5
					],
					"destination": [
						"obj-177",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-177",
						0
					],
					"destination": [
						"obj-176",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-176",
						0
					],
					"destination": [
						"obj-178",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-178",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-142",
						6
					],
					"destination": [
						"obj-180",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-180",
						0
					],
					"destination": [
						"obj-179",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-179",
						0
					],
					"destination": [
						"obj-181",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-181",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-142",
						7
					],
					"destination": [
						"obj-183",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-183",
						0
					],
					"destination": [
						"obj-182",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-182",
						0
					],
					"destination": [
						"obj-184",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-184",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-142",
						8
					],
					"destination": [
						"obj-186",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-186",
						0
					],
					"destination": [
						"obj-185",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-185",
						0
					],
					"destination": [
						"obj-187",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-187",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-188",
						0
					],
					"destination": [
						"obj-189",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-189",
						0
					],
					"destination": [
						"obj-190",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-189",
						1
					],
					"destination": [
						"obj-190",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-190",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-191",
						0
					],
					"destination": [
						"obj-192",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-192",
						0
					],
					"destination": [
						"obj-193",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-192",
						1
					],
					"destination": [
						"obj-193",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-193",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-142",
						9
					],
					"destination": [
						"obj-195",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-195",
						0
					],
					"destination": [
						"obj-194",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-194",
						0
					],
					"destination": [
						"obj-196",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-196",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-197",
						0
					],
					"destination": [
						"obj-198",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-198",
						0
					],
					"destination": [
						"obj-199",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-198",
						1
					],
					"destination": [
						"obj-199",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-199",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-142",
						10
					],
					"destination": [
						"obj-201",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-201",
						0
					],
					"destination": [
						"obj-200",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-200",
						0
					],
					"destination": [
						"obj-202",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-202",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-142",
						11
					],
					"destination": [
						"obj-204",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-204",
						0
					],
					"destination": [
						"obj-203",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-203",
						0
					],
					"destination": [
						"obj-205",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-205",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-142",
						12
					],
					"destination": [
						"obj-207",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-207",
						0
					],
					"destination": [
						"obj-206",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-206",
						0
					],
					"destination": [
						"obj-208",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-208",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-142",
						13
					],
					"destination": [
						"obj-210",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-210",
						0
					],
					"destination": [
						"obj-209",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-209",
						0
					],
					"destination": [
						"obj-211",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-211",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-142",
						14
					],
					"destination": [
						"obj-213",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-213",
						0
					],
					"destination": [
						"obj-212",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-212",
						0
					],
					"destination": [
						"obj-214",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-214",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-217",
						0
					],
					"destination": [
						"obj-218",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-218",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-219",
						0
					],
					"destination": [
						"obj-220",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-220",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-216",
						0
					],
					"destination": [
						"obj-222",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-222",
						0
					],
					"destination": [
						"obj-221",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-221",
						0
					],
					"destination": [
						"obj-223",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-223",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-224",
						0
					],
					"destination": [
						"obj-225",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-225",
						0
					],
					"destination": [
						"obj-226",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-225",
						1
					],
					"destination": [
						"obj-226",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-226",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-227",
						0
					],
					"destination": [
						"obj-228",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-228",
						0
					],
					"destination": [
						"obj-229",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-228",
						1
					],
					"destination": [
						"obj-229",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-229",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-230",
						0
					],
					"destination": [
						"obj-231",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-231",
						0
					],
					"destination": [
						"obj-232",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-231",
						1
					],
					"destination": [
						"obj-232",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-232",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-233",
						0
					],
					"destination": [
						"obj-234",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-234",
						0
					],
					"destination": [
						"obj-235",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-234",
						1
					],
					"destination": [
						"obj-235",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-235",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-236",
						0
					],
					"destination": [
						"obj-237",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-237",
						0
					],
					"destination": [
						"obj-238",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-237",
						1
					],
					"destination": [
						"obj-238",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-238",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-216",
						1
					],
					"destination": [
						"obj-240",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-240",
						0
					],
					"destination": [
						"obj-239",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-239",
						0
					],
					"destination": [
						"obj-241",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-241",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-216",
						2
					],
					"destination": [
						"obj-243",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-243",
						0
					],
					"destination": [
						"obj-242",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-242",
						0
					],
					"destination": [
						"obj-244",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-244",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-245",
						0
					],
					"destination": [
						"obj-246",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-246",
						0
					],
					"destination": [
						"obj-247",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-246",
						1
					],
					"destination": [
						"obj-247",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-247",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-249",
						0
					],
					"destination": [
						"obj-251",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-251",
						0
					],
					"destination": [
						"obj-250",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-250",
						0
					],
					"destination": [
						"obj-252",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-252",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-249",
						1
					],
					"destination": [
						"obj-254",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-254",
						0
					],
					"destination": [
						"obj-253",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-253",
						0
					],
					"destination": [
						"obj-255",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-255",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-249",
						2
					],
					"destination": [
						"obj-257",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-257",
						0
					],
					"destination": [
						"obj-256",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-256",
						0
					],
					"destination": [
						"obj-258",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-258",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-249",
						3
					],
					"destination": [
						"obj-260",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-260",
						0
					],
					"destination": [
						"obj-259",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-259",
						0
					],
					"destination": [
						"obj-261",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-261",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-249",
						4
					],
					"destination": [
						"obj-263",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-263",
						0
					],
					"destination": [
						"obj-262",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-262",
						0
					],
					"destination": [
						"obj-264",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-264",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-249",
						5
					],
					"destination": [
						"obj-266",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-266",
						0
					],
					"destination": [
						"obj-265",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-265",
						0
					],
					"destination": [
						"obj-267",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-267",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-249",
						6
					],
					"destination": [
						"obj-269",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-269",
						0
					],
					"destination": [
						"obj-268",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-268",
						0
					],
					"destination": [
						"obj-270",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-270",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-249",
						7
					],
					"destination": [
						"obj-272",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-272",
						0
					],
					"destination": [
						"obj-271",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-271",
						0
					],
					"destination": [
						"obj-273",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-273",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-249",
						8
					],
					"destination": [
						"obj-275",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-275",
						0
					],
					"destination": [
						"obj-274",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-274",
						0
					],
					"destination": [
						"obj-276",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-276",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-249",
						9
					],
					"destination": [
						"obj-278",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-278",
						0
					],
					"destination": [
						"obj-277",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-277",
						0
					],
					"destination": [
						"obj-279",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-279",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-249",
						10
					],
					"destination": [
						"obj-281",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-281",
						0
					],
					"destination": [
						"obj-280",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-280",
						0
					],
					"destination": [
						"obj-282",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-282",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-1",
						2
					],
					"destination": [
						"obj-24",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-1",
						2
					],
					"destination": [
						"obj-65",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-1",
						2
					],
					"destination": [
						"obj-142",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-1",
						2
					],
					"destination": [
						"obj-216",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-1",
						2
					],
					"destination": [
						"obj-249",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-1",
						3
					],
					"destination": [
						"obj-284",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-284",
						0
					],
					"destination": [
						"obj-285",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-285",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-1",
						0
					],
					"destination": [
						"obj-288",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-287",
						0
					],
					"destination": [
						"obj-288",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-288",
						2
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-288",
						0
					],
					"destination": [
						"obj-289",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-288",
						1
					],
					"destination": [
						"obj-289",
						1
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-289",
						0
					],
					"destination": [
						"obj-290",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-289",
						1
					],
					"destination": [
						"obj-290",
						1
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-288",
						0
					],
					"destination": [
						"obj-292",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-288",
						1
					],
					"destination": [
						"obj-292",
						1
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-1",
						4
					],
					"destination": [
						"obj-292",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-1",
						1
					],
					"destination": [
						"obj-303",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-303",
						0
					],
					"destination": [
						"obj-304",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-304",
						1
					],
					"destination": [
						"obj-305",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-305",
						0
					],
					"destination": [
						"obj-306",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-306",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-303",
						1
					],
					"destination": [
						"obj-307",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-307",
						1
					],
					"destination": [
						"obj-308",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-308",
						0
					],
					"destination": [
						"obj-309",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-309",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-303",
						2
					],
					"destination": [
						"obj-310",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-310",
						1
					],
					"destination": [
						"obj-311",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-311",
						0
					],
					"destination": [
						"obj-312",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-312",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-303",
						3
					],
					"destination": [
						"obj-313",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-313",
						1
					],
					"destination": [
						"obj-314",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-314",
						0
					],
					"destination": [
						"obj-315",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-315",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-303",
						4
					],
					"destination": [
						"obj-316",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-316",
						1
					],
					"destination": [
						"obj-317",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-317",
						0
					],
					"destination": [
						"obj-318",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-318",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-303",
						5
					],
					"destination": [
						"obj-319",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-319",
						1
					],
					"destination": [
						"obj-320",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-320",
						0
					],
					"destination": [
						"obj-321",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-321",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-303",
						6
					],
					"destination": [
						"obj-322",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-322",
						1
					],
					"destination": [
						"obj-323",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-323",
						0
					],
					"destination": [
						"obj-324",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-324",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-303",
						7
					],
					"destination": [
						"obj-325",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-325",
						1
					],
					"destination": [
						"obj-326",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-326",
						0
					],
					"destination": [
						"obj-327",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-327",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-303",
						8
					],
					"destination": [
						"obj-328",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-328",
						1
					],
					"destination": [
						"obj-329",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-329",
						0
					],
					"destination": [
						"obj-330",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-330",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-303",
						9
					],
					"destination": [
						"obj-331",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-331",
						1
					],
					"destination": [
						"obj-332",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-332",
						0
					],
					"destination": [
						"obj-333",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-333",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-303",
						10
					],
					"destination": [
						"obj-334",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-334",
						1
					],
					"destination": [
						"obj-335",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-335",
						0
					],
					"destination": [
						"obj-336",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-336",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-303",
						11
					],
					"destination": [
						"obj-337",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-337",
						1
					],
					"destination": [
						"obj-338",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-338",
						0
					],
					"destination": [
						"obj-339",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-339",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-303",
						12
					],
					"destination": [
						"obj-340",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-340",
						1
					],
					"destination": [
						"obj-341",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-341",
						0
					],
					"destination": [
						"obj-342",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-342",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-303",
						13
					],
					"destination": [
						"obj-343",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-343",
						1
					],
					"destination": [
						"obj-344",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-344",
						0
					],
					"destination": [
						"obj-345",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-345",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-303",
						14
					],
					"destination": [
						"obj-346",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-346",
						1
					],
					"destination": [
						"obj-347",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-347",
						0
					],
					"destination": [
						"obj-348",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-348",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-303",
						15
					],
					"destination": [
						"obj-349",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-349",
						1
					],
					"destination": [
						"obj-350",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-350",
						0
					],
					"destination": [
						"obj-351",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-351",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			}
		],
		"bglocked": 0,
		"autosave": 0
	}
}
