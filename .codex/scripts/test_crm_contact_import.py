import pathlib
import sys
import unittest


SCRIPT_DIR = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from crm_contact_import import (  # noqa: E402
    COUNTRY_OPTIONS,
    apply_import_plan,
    build_import_plan,
    contact_payload,
    country_value,
    ensure_company_metadata,
    map_company_type,
    note_payload,
    normalize_email,
    normalize_company_key,
    normalize_website_for_storage,
    source_company_payload,
)


class CrmContactImportTests(unittest.TestCase):
    def test_maps_company_type_conservatively(self):
        self.assertEqual(map_company_type("Real Estate Developer"), "DEVELOPER")
        self.assertEqual(map_company_type("Architect Office / Design Studio"), "ARCHITECTURAL_BUREAU")
        self.assertEqual(map_company_type("Construction / Contractor"), "BUILDERS")
        self.assertEqual(map_company_type("Distribution partner"), "DISTIBUTORS")
        self.assertIsNone(map_company_type("Data Center"))

    def test_normalizes_common_company_suffixes(self):
        self.assertEqual(normalize_company_key("Sensor Innovation AS"), "sensor innovation")
        self.assertEqual(normalize_company_key("Sensor Innovation"), "sensor innovation")

    def test_drops_non_url_like_website_values(self):
        self.assertEqual(normalize_website_for_storage("International"), "")
        self.assertEqual(normalize_website_for_storage("www.yit.fi/en"), "https://www.yit.fi/en")

    def test_normalizes_email_cells_with_trailing_separators(self):
        self.assertEqual(normalize_email("alice@example.com;"), "alice@example.com")
        self.assertEqual(normalize_email("alice@example.com,"), "alice@example.com")
        self.assertEqual(normalize_email("<alice@example.com>;"), "alice@example.com")
        self.assertEqual(normalize_email("alice@example.com; bob@example.com"), "alice@example.com")
        self.assertEqual(normalize_email("alice@example.com,bob@example.com"), "alice@example.com")

        payload = contact_payload(
            {
                "contact_first_name": "Alice",
                "contact_last_name": "Example",
                "contact_email": "alice@example.com;",
                "contact_phone": "",
                "contact_position": "",
                "contact_linkedin": "",
                "country": "Finland",
            },
            company_id=None,
        )

        self.assertEqual(payload["emails"]["primaryEmail"], "alice@example.com")

    def test_maps_all_canonical_country_values(self):
        for label, value, _color in COUNTRY_OPTIONS:
            with self.subTest(country=label):
                self.assertEqual(country_value(label), value)
            with self.subTest(country=value):
                self.assertEqual(country_value(value), value)

    def test_maps_common_country_aliases(self):
        self.assertEqual(country_value("UAE"), "UNITED_ARAB_EMIRATES")
        self.assertEqual(country_value("U.A.E."), "UNITED_ARAB_EMIRATES")
        self.assertEqual(country_value("United Arab Emirates/UAE"), "UNITED_ARAB_EMIRATES")
        self.assertEqual(country_value("UAE / United Arab Emirates"), "UNITED_ARAB_EMIRATES")
        self.assertEqual(country_value("Czech Republic"), "CZECHIA")
        self.assertEqual(country_value("MENA"), "MENA")
        self.assertEqual(country_value("Middle East & North Africa"), "MENA")
        self.assertEqual(country_value("NZ"), "NEW_ZEALAND")
        self.assertEqual(country_value("UK"), "UNITED_KINGDOM")
        self.assertEqual(country_value("Kuwait"), "KUWAIT")
        self.assertEqual(country_value("Sweden"), "SWEDEN")

    def test_source_company_payload_sets_canonical_non_baltic_territory(self):
        payload = source_company_payload(
            {
                "name": "Controlit Gulf",
                "country": "UAE",
                "category": "",
                "website": "",
                "city": "",
                "project_types": "",
                "target_person_role": "",
            }
        )

        self.assertEqual(payload["companyCountry"], "UNITED_ARAB_EMIRATES")

    def test_skips_placeholder_company_names(self):
        plan = build_import_plan(
            [
                {
                    "source_file": "SOMIJA DCF CRM .xlsx",
                    "source_sheet": "Sheet1",
                    "source_row": 25,
                    "country": "Finland",
                    "company": "NA",
                    "company_category": "",
                    "company_website": "",
                    "company_city": "",
                    "project_types": "",
                    "target_role_to_meet": "",
                    "company_notes": "",
                    "contact_full_name": "Dovydas Janusas",
                    "contact_first_name": "Dovydas",
                    "contact_last_name": "Janusas",
                    "contact_position": "NA",
                    "contact_email": "",
                    "contact_phone": "",
                    "contact_linkedin": "https://www.linkedin.com/in/example/",
                    "contact_note": "",
                }
            ],
            {"companies": [], "people": [], "note_import_keys": set()},
        )

        self.assertEqual(len(plan["company_creates"]), 0)
        self.assertEqual(len(plan["person_creates"]), 0)
        self.assertEqual(len(plan["skipped_company_rows"]), 1)

    def test_plans_fill_only_updates_and_generic_contact_notes(self):
        source_records = [
            {
                "source_file": "CRM EXCEL .xlsx",
                "source_sheet": "FINLAND CONTACTS ",
                "source_row": 2,
                "country": "Finland",
                "company": "Sensor Innovation",
                "company_category": "Data Center",
                "company_website": "www.sensorinnovation.no",
                "company_city": "Oslo",
                "project_types": "Monitoring",
                "target_role_to_meet": "",
                "company_notes": "Existing customer",
                "contact_full_name": "Eirik Kristiansen",
                "contact_first_name": "Eirik",
                "contact_last_name": "Kristiansen",
                "contact_position": "CEO",
                "contact_email": "eirik.kristiansen@sensorinnovation.no",
                "contact_phone": "+47 111",
                "contact_linkedin": "",
            },
            {
                "source_file": "CRM EXCEL .xlsx",
                "source_sheet": "FINLAND CONTACTS ",
                "source_row": 3,
                "country": "Finland",
                "company": "Sensor Innovation",
                "company_category": "Data Center",
                "company_website": "www.sensorinnovation.no",
                "company_city": "Oslo",
                "project_types": "Monitoring",
                "target_role_to_meet": "",
                "company_notes": "",
                "contact_full_name": "",
                "contact_first_name": "",
                "contact_last_name": "",
                "contact_position": "General",
                "contact_email": "info@sensorinnovation.no",
                "contact_phone": "+47 222",
                "contact_linkedin": "",
            },
        ]
        existing = {
            "companies": [
                {
                    "id": "company-1",
                    "name": "Sensor Innovation AS",
                    "domainNamePrimaryLinkUrl": "www.sensorinnovation.no",
                    "companyCountry": None,
                    "companyCategoryRaw": None,
                    "projectTypes": None,
                    "targetPersonRole": None,
                }
            ],
            "people": [
                {
                    "id": "person-1",
                    "nameFirstName": "Eirik",
                    "nameLastName": "Kristiansen",
                    "emailsPrimaryEmail": "eirik.kristiansen@sensorinnovation.no",
                    "jobTitle": None,
                    "phonesPrimaryPhoneNumber": None,
                    "linkedinLinkPrimaryLinkUrl": None,
                    "companyId": "company-1",
                }
            ],
            "note_import_keys": set(),
        }

        plan = build_import_plan(source_records, existing)

        self.assertEqual(len(plan["company_creates"]), 0)
        self.assertEqual(len(plan["company_updates"]), 1)
        self.assertEqual(plan["company_updates"][0]["id"], "company-1")
        self.assertEqual(plan["company_updates"][0]["data"]["companyCountry"], "FINLAND")
        self.assertEqual(len(plan["person_creates"]), 0)
        self.assertEqual(len(plan["person_updates"]), 1)
        self.assertEqual(plan["person_updates"][0]["data"]["jobTitle"], "CEO")
        self.assertEqual(len(plan["company_notes"]), 2)
        self.assertTrue(any("Generic contact" in note["body"] for note in plan["company_notes"]))

    def test_uses_rest_composite_payloads_for_new_records(self):
        source_records = [
            {
                "source_file": "CRM EXCEL .xlsx",
                "source_sheet": "FINLAND CONTACTS ",
                "source_row": 10,
                "country": "Finland",
                "company": "YIT",
                "company_category": "Real Estate Developer",
                "company_website": "www.yit.fi",
                "company_city": "Helsinki",
                "project_types": "Residential",
                "target_role_to_meet": "Development director",
                "company_notes": "",
                "contact_full_name": "Jane Manager",
                "contact_first_name": "Jane",
                "contact_last_name": "Manager",
                "contact_position": "Director",
                "contact_email": "jane.manager@yit.fi",
                "contact_phone": "+358 123",
                "contact_linkedin": "https://www.linkedin.com/in/jane-manager/",
            }
        ]

        plan = build_import_plan(source_records, {"companies": [], "people": [], "note_import_keys": set()})

        company_payload = plan["company_creates"][0]["data"]
        person_payload = plan["person_creates"][0]["data"]
        self.assertNotIn("domainNamePrimaryLinkUrl", company_payload)
        self.assertEqual(company_payload["domainName"]["primaryLinkUrl"], "https://www.yit.fi")
        self.assertEqual(company_payload["address"]["addressCity"], "Helsinki")
        self.assertEqual(company_payload["companyType"], "DEVELOPER")
        self.assertNotIn("emailsPrimaryEmail", person_payload)
        self.assertEqual(person_payload["name"]["firstName"], "Jane")
        self.assertEqual(person_payload["emails"]["primaryEmail"], "jane.manager@yit.fi")
        self.assertEqual(person_payload["phones"]["primaryPhoneNumber"], "+358 123")
        self.assertEqual(person_payload["personTerritory"], "FINLAND")

    def test_assigns_territory_to_existing_person_updates(self):
        source_records = [
            {
                "source_file": "CRM EXCEL .xlsx",
                "source_sheet": "UAE CONTACTS ",
                "source_row": 11,
                "country": "UAE",
                "company": "Controlit Gulf",
                "company_category": "",
                "company_website": "https://controlit.example",
                "company_city": "Dubai",
                "project_types": "",
                "target_role_to_meet": "",
                "company_notes": "",
                "contact_full_name": "Jane Manager",
                "contact_first_name": "Jane",
                "contact_last_name": "Manager",
                "contact_position": "",
                "contact_email": "jane.manager@controlit.example",
                "contact_phone": "",
                "contact_linkedin": "",
            }
        ]
        existing = {
            "companies": [
                {
                    "id": "company-1",
                    "name": "Controlit Gulf",
                    "domainName": {"primaryLinkUrl": "https://controlit.example"},
                    "companyCountry": "UNITED_ARAB_EMIRATES",
                }
            ],
            "people": [
                {
                    "id": "person-1",
                    "name": {"firstName": "Jane", "lastName": "Manager"},
                    "emails": {"primaryEmail": "jane.manager@controlit.example"},
                    "personTerritory": None,
                    "companyId": "company-1",
                }
            ],
            "note_import_keys": set(),
        }

        plan = build_import_plan(source_records, existing)

        self.assertEqual(len(plan["person_updates"]), 1)
        self.assertEqual(plan["person_updates"][0]["data"]["personTerritory"], "UNITED_ARAB_EMIRATES")

    def test_adds_country_phone_metadata_for_non_plus_numbers(self):
        source_records = [
            {
                "source_file": "CRM EXCEL .xlsx",
                "source_sheet": "FINLAND CONTACTS ",
                "source_row": 10,
                "country": "Finland",
                "company": "YIT",
                "company_category": "",
                "company_website": "",
                "company_city": "",
                "project_types": "",
                "target_role_to_meet": "",
                "company_notes": "",
                "contact_full_name": "Jane Manager",
                "contact_first_name": "Jane",
                "contact_last_name": "Manager",
                "contact_position": "Director",
                "contact_email": "jane.manager@yit.fi",
                "contact_phone": "358 40 621 4974",
                "contact_linkedin": "",
            }
        ]

        plan = build_import_plan(source_records, {"companies": [], "people": [], "note_import_keys": set()})

        self.assertEqual(plan["person_creates"][0]["data"]["phones"]["primaryPhoneNumber"], "358 40 621 4974")
        self.assertEqual(plan["person_creates"][0]["data"]["phones"]["primaryPhoneCountryCode"], "FI")
        self.assertEqual(plan["person_creates"][0]["data"]["phones"]["primaryPhoneCallingCode"], "358")

    def test_dedupes_against_rest_composite_existing_records(self):
        source_records = [
            {
                "source_file": "CRM EXCEL .xlsx",
                "source_sheet": "FINLAND CONTACTS ",
                "source_row": 11,
                "country": "Finland",
                "company": "YIT",
                "company_category": "Real Estate Developer",
                "company_website": "https://www.yit.fi",
                "company_city": "Helsinki",
                "project_types": "Residential",
                "target_role_to_meet": "",
                "company_notes": "",
                "contact_full_name": "Jane Manager",
                "contact_first_name": "Jane",
                "contact_last_name": "Manager",
                "contact_position": "Director",
                "contact_email": "jane.manager@yit.fi",
                "contact_phone": "+358 123",
                "contact_linkedin": "",
            }
        ]
        existing = {
            "companies": [
                {
                    "id": "company-1",
                    "name": "YIT",
                    "domainName": {"primaryLinkUrl": "https://www.yit.fi", "primaryLinkLabel": "yit.fi"},
                    "address": {"addressCity": "", "addressCountry": ""},
                    "companyCountry": None,
                    "companyCategoryRaw": "",
                    "projectTypes": "",
                    "targetPersonRole": "",
                    "companyType": None,
                }
            ],
            "people": [
                {
                    "id": "person-1",
                    "name": {"firstName": "Jane", "lastName": "Manager"},
                    "emails": {"primaryEmail": "jane.manager@yit.fi"},
                    "jobTitle": "",
                    "phones": {"primaryPhoneNumber": ""},
                    "linkedinLink": {"primaryLinkUrl": ""},
                    "companyId": "company-1",
                }
            ],
            "note_import_keys": set(),
        }

        plan = build_import_plan(source_records, existing)

        self.assertEqual(len(plan["company_creates"]), 0)
        self.assertEqual(len(plan["person_creates"]), 0)
        self.assertEqual(plan["company_updates"][0]["id"], "company-1")
        self.assertEqual(plan["company_updates"][0]["data"]["address"]["addressCity"], "Helsinki")
        self.assertEqual(plan["person_updates"][0]["id"], "person-1")
        self.assertEqual(plan["person_updates"][0]["data"]["jobTitle"], "Director")

    def test_merges_same_source_person_by_company_name_and_email_aliases(self):
        base_record = {
            "source_file": "SOMIJA DCF CRM .xlsx",
            "source_sheet": "Sheet1",
            "country": "Finland",
            "company": "Sensor Innovation",
            "company_category": "",
            "company_website": "www.sensorinnovation.no",
            "company_city": "",
            "project_types": "",
            "target_role_to_meet": "",
            "company_notes": "",
            "contact_full_name": "Bogdan Glogovac",
            "contact_first_name": "Bogdan",
            "contact_last_name": "Glogovac",
            "contact_position": "Customer Success Manager",
            "contact_phone": "",
            "contact_linkedin": "",
        }
        source_records = [
            {**base_record, "source_row": 2, "contact_email": ""},
            {**base_record, "source_row": 3, "contact_email": "bogdan.glogovac@sensorinnovation.no"},
        ]

        plan = build_import_plan(source_records, {"companies": [], "people": [], "note_import_keys": set()})

        self.assertEqual(len(plan["person_creates"]), 1)
        self.assertEqual(
            plan["person_creates"][0]["data"]["emails"]["primaryEmail"],
            "bogdan.glogovac@sensorinnovation.no",
        )

    def test_merges_source_companies_by_domain_before_creating(self):
        source_records = [
            {
                "source_file": "CRM EXCEL .xlsx",
                "source_sheet": "ESTONIA CONTACTS ",
                "source_row": 2,
                "country": "Estonia",
                "company": "Harmet",
                "company_category": "Construction",
                "company_website": "https://www.harmet.ee",
                "company_city": "",
                "project_types": "",
                "target_role_to_meet": "",
                "company_notes": "",
                "contact_full_name": "First Person",
                "contact_first_name": "First",
                "contact_last_name": "Person",
                "contact_position": "",
                "contact_email": "first@harmet.ee",
                "contact_phone": "",
                "contact_linkedin": "",
            },
            {
                "source_file": "CRM EXCEL .xlsx",
                "source_sheet": "ESTONIA CONTACTS ",
                "source_row": 3,
                "country": "Estonia",
                "company": "Harmet Modular",
                "company_category": "Builder",
                "company_website": "www.harmet.ee",
                "company_city": "",
                "project_types": "",
                "target_role_to_meet": "",
                "company_notes": "",
                "contact_full_name": "Second Person",
                "contact_first_name": "Second",
                "contact_last_name": "Person",
                "contact_position": "",
                "contact_email": "second@harmet.ee",
                "contact_phone": "",
                "contact_linkedin": "",
            },
        ]

        plan = build_import_plan(source_records, {"companies": [], "people": [], "note_import_keys": set()})

        self.assertEqual(plan["source_company_count"], 1)
        self.assertEqual(len(plan["company_creates"]), 1)
        self.assertEqual(len(plan["person_creates"]), 2)

    def test_applies_notes_for_domain_matched_company_with_no_update(self):
        source_records = [
            {
                "source_file": "CRM EXCEL .xlsx",
                "source_sheet": "ESTONIA CONTACTS ",
                "source_row": 4,
                "country": "Estonia",
                "company": "Harmet Modular",
                "company_category": "",
                "company_website": "www.harmet.ee",
                "company_city": "",
                "project_types": "",
                "target_role_to_meet": "",
                "company_notes": "Existing customer note",
                "contact_full_name": "",
                "contact_first_name": "",
                "contact_last_name": "",
                "contact_position": "",
                "contact_email": "",
                "contact_phone": "",
                "contact_linkedin": "",
            }
        ]
        existing_state = {
            "companies": [
                {
                    "id": "company-1",
                    "name": "Harmet AS",
                    "domainName": {
                        "primaryLinkUrl": "https://www.harmet.ee",
                        "primaryLinkLabel": "harmet.ee",
                    },
                    "address": {"addressCountry": "Estonia"},
                    "companyCountry": "ESTONIA",
                    "companyCategoryRaw": "",
                    "projectTypes": "",
                    "targetPersonRole": "",
                    "companyType": None,
                }
            ],
            "people": [],
            "note_import_keys": set(),
        }

        plan = build_import_plan(source_records, existing_state)

        self.assertEqual(plan["company_ids_by_key"], {"harmet modular": "company-1"})
        self.assertEqual(plan["company_creates"], [])
        self.assertEqual(plan["company_updates"], [])
        self.assertEqual(len(plan["company_notes"]), 1)

        class FakeClient:
            def __init__(self):
                self.calls = []

            def rest(self, method, path, body=None):
                self.calls.append((method, path, body))
                if method == "POST" and path == "/rest/notes":
                    return {"data": {"createNote": {"id": "note-1"}}}
                if method == "POST" and path == "/rest/noteTargets":
                    return {"data": {"createNoteTarget": {"id": "note-target-1"}}}
                raise AssertionError(f"unexpected REST call: {method} {path}")

        client = FakeClient()
        applied = apply_import_plan(client, plan, existing_state)

        self.assertEqual(applied["notes_created"], 1)
        self.assertIn(
            (
                "POST",
                "/rest/notes",
                {
                    "title": "CRM import - Company source notes",
                    "bodyV2": {
                        "markdown": plan["company_notes"][0]["body"],
                    },
                    "noteTerritory": "ESTONIA",
                },
            ),
            client.calls,
        )
        self.assertIn(("POST", "/rest/noteTargets", {"noteId": "note-1", "companyId": "company-1"}), client.calls)

    def test_updates_existing_no_email_person_when_source_later_has_email(self):
        base_record = {
            "source_file": "SOMIJA DCF CRM .xlsx",
            "source_sheet": "Sheet1",
            "country": "Finland",
            "company": "Sensor Innovation",
            "company_category": "",
            "company_website": "www.sensorinnovation.no",
            "company_city": "",
            "project_types": "",
            "target_role_to_meet": "",
            "company_notes": "",
            "contact_full_name": "Bogdan Glogovac",
            "contact_first_name": "Bogdan",
            "contact_last_name": "Glogovac",
            "contact_position": "Customer Success Manager",
            "contact_phone": "",
            "contact_linkedin": "",
        }
        existing = {
            "companies": [
                {
                    "id": "company-1",
                    "name": "Sensor Innovation AS",
                    "domainName": {"primaryLinkUrl": "www.sensorinnovation.no"},
                }
            ],
            "people": [
                {
                    "id": "person-1",
                    "name": {"firstName": "Bogdan", "lastName": "Glogovac"},
                    "emails": {"primaryEmail": ""},
                    "jobTitle": "Customer Success Manager",
                    "phones": {"primaryPhoneNumber": ""},
                    "companyId": "company-1",
                }
            ],
            "note_import_keys": set(),
        }

        plan = build_import_plan(
            [
                {**base_record, "source_row": 2, "contact_email": ""},
                {**base_record, "source_row": 3, "contact_email": "bogdan.glogovac@sensorinnovation.no"},
            ],
            existing,
        )

        self.assertEqual(len(plan["person_creates"]), 0)
        self.assertEqual(len(plan["person_updates"]), 1)
        self.assertEqual(plan["person_updates"][0]["id"], "person-1")
        self.assertEqual(
            plan["person_updates"][0]["data"]["emails"]["primaryEmail"],
            "bogdan.glogovac@sensorinnovation.no",
        )

    def test_uses_rest_rich_text_payload_for_notes(self):
        payload = note_payload(
            {
                "title": "CRM import - Generic contact",
                "body": "Generic contact\n[CRM_IMPORT:x:y]",
                "territory": "ESTONIA",
            }
        )

        self.assertEqual(payload["title"], "CRM import - Generic contact")
        self.assertEqual(payload["bodyV2"]["markdown"], "Generic contact\n[CRM_IMPORT:x:y]")
        self.assertEqual(payload["noteTerritory"], "ESTONIA")
        self.assertNotIn("bodyV2Markdown", payload)

    def test_metadata_dry_run_handles_missing_fields_before_view_planning(self):
        class FakeClient:
            def metadata_request(self, *_args, **_kwargs):
                return {
                    "objects": {
                        "edges": [
                            {
                                "node": {
                                    "id": "company-object",
                                    "nameSingular": "company",
                                    "namePlural": "companies",
                                    "labelPlural": "Companies",
                                    "fieldsList": [
                                        {"id": "name-field", "name": "name", "label": "Name", "type": "TEXT", "options": None},
                                        {
                                            "id": "company-type-field",
                                            "name": "companyType",
                                            "label": "Company Type",
                                            "type": "SELECT",
                                            "options": [],
                                        },
                                    ],
                                }
                            }
                        ]
                    }
                }

            def rest(self, *_args, **_kwargs):
                raise AssertionError("dry-run metadata setup should not fetch view fields for missing fields")

        actions = ensure_company_metadata(FakeClient(), apply=False)

        self.assertIn("create field companyCountry", actions)
        self.assertIn("create field targetPersonRole", actions)

    def test_metadata_dry_run_is_noop_when_existing_import_fields_are_already_contiguous(self):
        field_names = [
            "name",
            "companyType",
            "companyCountry",
            "companyCategoryRaw",
            "projectTypes",
            "targetPersonRole",
        ]
        fields = [
            {
                "id": f"{field_name}-field",
                "name": field_name,
                "label": field_name,
                "type": "SELECT" if field_name in {"companyType", "companyCountry"} else "TEXT",
                "options": [
                    {"label": label, "value": value, "color": color, "position": index}
                    for index, (label, value, color) in enumerate(COUNTRY_OPTIONS)
                ]
                if field_name == "companyCountry"
                else [],
            }
            for field_name in field_names
        ]

        class FakeClient:
            def metadata_request(self, *_args, **_kwargs):
                return {
                    "objects": {
                        "edges": [
                            {
                                "node": {
                                    "id": "company-object",
                                    "nameSingular": "company",
                                    "namePlural": "companies",
                                    "labelPlural": "Companies",
                                    "fieldsList": fields,
                                }
                            }
                        ]
                    }
                }

            def rest(self, method, path, *_args, **_kwargs):
                if path.startswith("/rest/metadata/views"):
                    return [{"id": "view-1", "type": "TABLE", "position": 0}]
                if path.startswith("/rest/metadata/viewFields"):
                    return [
                        {"id": "name-vf", "fieldMetadataId": "name-field", "isVisible": True, "size": 180, "position": 0},
                        {
                            "id": "country-vf",
                            "fieldMetadataId": "companyCountry-field",
                            "isVisible": True,
                            "size": 150,
                            "position": 8,
                        },
                        {
                            "id": "category-vf",
                            "fieldMetadataId": "companyCategoryRaw-field",
                            "isVisible": True,
                            "size": 150,
                            "position": 9,
                        },
                        {
                            "id": "types-vf",
                            "fieldMetadataId": "projectTypes-field",
                            "isVisible": True,
                            "size": 150,
                            "position": 10,
                        },
                        {
                            "id": "target-vf",
                            "fieldMetadataId": "targetPersonRole-field",
                            "isVisible": True,
                            "size": 150,
                            "position": 11,
                        },
                    ]
                raise AssertionError(f"unexpected {method} {path}")

        self.assertEqual(ensure_company_metadata(FakeClient(), apply=False), [])


if __name__ == "__main__":
    unittest.main()
