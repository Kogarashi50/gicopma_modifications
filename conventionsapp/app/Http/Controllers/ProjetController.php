<?php

namespace App\Http\Controllers;

use App\Models\Document;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use App\Models\Projet;
use App\Models\SousProjet;
use App\Models\EngagementFinancier;
use App\Models\Versement;

// Required Facades and Classes
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException as LaravelValidationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\QueryException;

class ProjetController extends Controller
{
    private function mapProjectVersementsForCreate(array $versements): array
    {
        return collect($versements)
            ->map(function ($versementData) {
                $year = $versementData['annee'] ?? null;
                $dateVersement = $versementData['date_versement'] ?? ($year ? sprintf('%04d-01-01', (int) $year) : null);
                $montantVerse = $versementData['montant_verse'] ?? $versementData['montant'] ?? null;

                return [
                    'date_versement' => $dateVersement,
                    'montant_verse' => $montantVerse,
                    'commentaire' => $versementData['commentaire'] ?? null,
                ];
            })
            ->filter(fn ($versementData) => !empty($versementData['date_versement']) && $versementData['montant_verse'] !== null)
            ->values()
            ->all();
    }

    public function getUniqueFieldValues(Request $request, string $field): JsonResponse
    {
        $allowedFields = ['maitre_ouvrage', 'maitre_ouvrage_delegue'];
        if (!in_array($field, $allowedFields)) {
            return response()->json(['message' => 'Champ non autorisé.'], 400);
        }
        try {
            $values = Projet::whereNotNull($field)->where($field, '!=', '')->distinct()->orderBy($field)->pluck($field);
            $options = $values->map(fn($value) => ['value' => $value, 'label' => $value]);
            return response()->json($options);
        } catch (\Exception $e) {
            Log::error("Error fetching unique values for field '{$field}': " . $e->getMessage());
            return response()->json(['message' => 'Erreur serveur.'], 500);
        }
    }

    public function getLocations(string $projet_code): JsonResponse
    {
        try {
            $projet = Projet::where('Code_Projet', $projet_code)->with(['provinces:Id,Description', 'communes:Id,Description'])->firstOrFail();
            return response()->json(['provinces' => $projet->provinces, 'communes' => $projet->communes]);
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Projet maître non trouvé.'], 404);
        } catch (\Exception $e) {
            Log::error('Error fetching project locations for ' . $projet_code . ': ' . $e->getMessage());
            return response()->json(['message' => 'Erreur serveur lors de la récupération des localisations.'], 500);
        }
    }

    public function index(): JsonResponse
    {
        try {
            $projets = Projet::with(['programme', 'provinces', 'communes', 'convention', 'secteur','maitresOuvrage','maitresOuvrageDelegues','engagementsFinanciers.partenaire','engagementsFinanciers.versements'])->orderBy('created_at', 'desc')->get();
            return response()->json(['projets' => $projets]);
        } catch (\Exception $e) {
            Log::error('Error fetching projets: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erreur serveur lors de la récupération des projets.'], 500);
        }
    }

    public function getOptions(Request $request): JsonResponse
    {
        try {
            $projets = Projet::orderBy('Nom_Projet')->get(['ID_Projet', 'Code_Projet', 'Nom_Projet']);
            $options = $projets->map(function ($projet) {
                $label = $projet->Nom_Projet;
                if (!empty($projet->Code_Projet) && !empty($projet->Nom_Projet)) {
                    $label = $projet->Code_Projet . ' - ' . $projet->Nom_Projet;
                } elseif (empty($label) && !empty($projet->Code_Projet)) {
                    $label = $projet->Code_Projet;
                } elseif (empty($label)) {
                    $label = "Projet ID: {$projet->ID_Projet}";
                }
                return ['value' => $projet->ID_Projet, 'label' => $label, 'code' => $projet->Code_Projet];
            });
            return response()->json($options);
        } catch (\Exception $e) {
            Log::error('Error fetching Projet options: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erreur serveur lors du chargement des options de projets.'], 500);
        }
    }
 public function show(string $id): JsonResponse
    {
        try {
            // **CORRECTION** : Assure le chargement des versements
            $projet = Projet::where('ID_Projet', $id)
                ->with([
                    'programme', 'convention', 'provinces', 'communes', 'secteur',
                    'engagementsFinanciers.partenaire',
                    'engagementsFinanciers.versements',
                    'maitresOuvrage',
                    'maitresOuvrageDelegues'
                ])
                ->firstOrFail();
            return response()->json(['projet' => $projet]);
        } catch (ModelNotFoundException $e) {
             return response()->json(['message' => 'Projet non trouvé.'], 404);
        } catch (\Exception $e) {
            Log::error('Error fetching projet by ID_Projet ' . $id . ': ' . $e->getMessage());
            return response()->json(['message' => 'Erreur serveur lors de la récupération du projet.'], 500);
        }
    }

    public function store(Request $request): JsonResponse
    {
        $validationRules = [
            'Code_Projet' => ['required', 'integer', Rule::unique('projet', 'Code_Projet')],
            'Nom_Projet' => 'required|string|max:65535',
            'Id_Programme' => ['required', 'integer', Rule::exists('programme', 'Id')],
            'Convention_Code' => ['nullable', 'integer', Rule::exists('convention', 'id')],
            
            'secteur_id' => ['nullable', 'integer', Rule::exists('secteurs', 'id')],
            'province_ids' => 'nullable|array',
            'province_ids.*' => 'integer|exists:province,Id',
            'commune_ids' => 'nullable|array',
            'commune_ids.*' => 'integer|exists:commune,Id',
            
            'maitres_ouvrage_ids' => 'nullable|array',
            'maitres_ouvrage_ids.*' => 'integer|exists:maitre_ouvrage,id',


            'maitres_ouvrage_delegues_ids' => 'nullable|array',
            'maitres_ouvrage_delegues_ids.*' => 'integer|exists:maitre_ouvrage_delegue,id',

            'fichiers' => 'nullable|array',
            'fichiers.*' => 'file|mimes:pdf,doc,docx,jpg,png,xls,xlsx|max:5120',
            // --- Validation des Engagements ---
            'engagements' => 'present|array',
            'engagements.*.partenaire_id' => ['required', 'integer', Rule::exists('partenaire', 'Id')],
            'engagements.*.montant_convenu' => 'nullable|numeric|min:0',
            
            // **CORRECTION** : Validation pour les versements imbriqués
            'engagements.*.versements' => 'present|array',
            'engagements.*.versements.*.annee' => 'required|integer|min:1990|max:2100',
            'engagements.*.versements.*.montant' => 'required|numeric|min:0',
        ];

        try {
            $validatedData = $request->validate($validationRules);
        } catch (LaravelValidationException $e) {
            return response()->json(['message' => 'Les données fournies étaient invalides.', 'errors' => $e->errors()], 422);
        }

        DB::beginTransaction();
        try {
            $projetInputData = collect($validatedData)->except(['engagements', 'province_ids', 'commune_ids', 'maitres_ouvrage_ids','maitres_ouvrage_delegues_ids','fichiers',])->all();
            $projet = Projet::create($projetInputData);

            $projet->provinces()->sync($validatedData['province_ids'] ?? []);
            $projet->communes()->sync($validatedData['commune_ids'] ?? []);
            $projet->maitresOuvrage()->sync($validatedData['maitres_ouvrage_ids'] ?? []);
            $projet->maitresOuvrageDelegues()->sync($validatedData['maitres_ouvrage_delegues_ids'] ?? []);

            if (!empty($validatedData['engagements'])) {
                foreach($validatedData['engagements'] as $engData) {
                    $engagement = $projet->engagementsFinanciers()->create(
                        // Utilise collect pour ne prendre que les champs pertinents pour l'engagement
                        collect($engData)->only([
                           'partenaire_id', 'engagement_type_id', 'autre_engagement', 
                           'commentaire', 'date_engagement', 'is_signatory', 'details_signature'
                        ])->merge([
                           'montant_engage' => $engData['montant_convenu'] ?? null
                        ])->all()
                    );

                    // **CORRECTION** : Création des versements associés
                    if (!empty($engData['versements'])) {
                        $engagement->versements()->createMany($this->mapProjectVersementsForCreate($engData['versements']));
                    }
                }
            }
            
            if ($request->hasFile('fichiers')) {
                $targetDir = public_path('uploads/projets');

                if (!File::isDirectory($targetDir)) {
                    File::makeDirectory($targetDir, 0775, true);
                }

                $intitules = $request->input('intitules', []);

                foreach ($request->file('fichiers') as $index => $file) {
                    $filename = time() . '_' . Str::random(8) . '_' . $file->getClientOriginalName();

                    $file->move($targetDir, $filename);

                    $projet->documents()->create([
                        'Id_Doc' => 'projdoc_' . Str::uuid(),
                        'Intitule' => $intitules[$index] ?? $file->getClientOriginalName(),
                        'file_path' => 'uploads/projets/' . $filename,
                        'file_name' => $file->getClientOriginalName(),
                        'file_type' => $file->getClientMimeType(),
                        'file_size' => $file->getSize(),
                    ]);
                }
            }

            DB::commit();
            $projet->load(['programme', 'convention', 'engagementsFinanciers.partenaire', 'engagementsFinanciers.versements', 'provinces', 'communes', 'secteur']);
            return response()->json(['message' => 'Projet, engagements et versements créés avec succès.', 'projet' => $projet], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to store projet and engagements: ' . $e->getMessage(), ['request_data' => $request->all(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erreur serveur lors de la création du projet.'], 500);
        }
    }
    public function update(Request $request, string $id_projet_value): JsonResponse
    {
        try {
            $projet = Projet::findOrFail($id_projet_value);
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Projet non trouvé.'], 404);
        }

        $validationRules = [
            'Code_Projet' => ['required', 'integer', Rule::unique('projet', 'Code_Projet')->ignore($projet->ID_Projet, 'ID_Projet')],
            'Nom_Projet' => 'required|string|max:65535',
            'Id_Programme' => ['required', 'integer', Rule::exists('programme', 'Id')],
            'Convention_Code' => ['nullable', 'integer', Rule::exists('convention', 'id')],
            
            'maitres_ouvrage_ids' => 'nullable|array',
            'maitres_ouvrage_ids.*' => 'integer|exists:maitre_ouvrage,id',


            'maitres_ouvrage_delegues_ids' => 'nullable|array',
            'maitres_ouvrage_delegues_ids.*' => 'integer|exists:maitre_ouvrage_delegue,id',

            'fichiers' => 'nullable|array',
            'fichiers.*' => 'file|mimes:pdf,doc,docx,jpg,png,xls,xlsx|max:5120',
            'deleted_document_ids' => 'nullable|array',
            'deleted_document_ids.*' => 'string',

            'duree_projet_mois' => 'nullable|integer|min:0',
            'date_debut_prevue' => 'nullable|date_format:Y-m-d',
            'date_fin_prevue' => 'nullable|date_format:Y-m-d|after_or_equal:date_debut_prevue',
            'Cout_CRO' => 'nullable|numeric|min:0',
            'Date_Debut' => 'nullable|date_format:Y-m-d',
            'Observations' => 'nullable|string|max:65535',
            'Etat_Avan_Physi' => 'nullable|numeric|min:0|max:100',
            'Etat_Avan_Finan' => 'nullable|numeric|min:0|max:100',
            'secteur_id' => ['nullable', 'integer', Rule::exists('secteurs', 'id')],
            'Date_Fin' => 'nullable|date_format:Y-m-d|after_or_equal:Date_Debut',
            'Cout_Projet' => 'nullable|numeric|min:0',
            'id_fonctionnaire' => 'nullable|string',
            'province_ids' => 'nullable|array',
            'province_ids.*' => 'integer|exists:province,Id',
            'commune_ids' => 'nullable|array',
            'commune_ids.*' => 'integer|exists:commune,Id',
            
            'engagements' => 'present|array',
            // =========================================================================
            //   FIX 3: RÈGLE DE VALIDATION PLUS ROBUSTE POUR L'ID D'ENGAGEMENT
            // =========================================================================
            'engagements.*.id' => ['nullable', 'integer', Rule::exists('engagements_financiers', 'id')],

            'engagements.*.partenaire_id' => ['required', 'integer', Rule::exists('partenaire', 'Id')],
            'engagements.*.engagement_type_id' => ['nullable', 'integer', Rule::exists('engagement_types', 'id')],
            'engagements.*.montant_convenu' => 'nullable|numeric|min:0',
            'engagements.*.autre_engagement' => 'nullable|string|max:65535',
            'engagements.*.date_signature' => 'nullable|date_format:Y-m-d',
            'engagements.*.is_signatory' => 'nullable|boolean',
            'engagements.*.details_signature' => 'nullable|string|max:65535',
            'engagements.*.engagement_description' => 'nullable|string|max:65535',
            'confirm_cascade_delete' => 'sometimes|boolean',
        ];

        try {
            $validatedData = $request->validate($validationRules);
        } catch (LaravelValidationException $e) {
            return response()->json(['message' => 'Les données fournies étaient invalides.', 'errors' => $e->errors()], 422);
        }

        DB::beginTransaction();
        try {
            $projetInputData = collect($validatedData)->except(['engagements', 'province_ids', 'commune_ids','maitres_ouvrage_ids','maitres_ouvrage_delegues_ids','fichiers','deleted_document_ids', 'confirm_cascade_delete'])->all();
            $projet->update($projetInputData);
            Log::info("Projet main fields updated for ID_Projet: {$projet->ID_Projet}");

            $projet->provinces()->sync($validatedData['province_ids'] ?? []);
            $projet->communes()->sync($validatedData['commune_ids'] ?? []);
            $projet->maitresOuvrage()->sync($validatedData['maitres_ouvrage_ids'] ?? []);
            $projet->maitresOuvrageDelegues()->sync($validatedData['maitres_ouvrage_delegues_ids'] ?? []);


            $existingEngagementIds = $projet->engagementsFinanciers()->pluck('id')->toArray();
            $submittedEngagements = collect($validatedData['engagements'] ?? []);
            $submittedEngagementIds = $submittedEngagements->pluck('id')->filter()->unique()->toArray();
            $engagementIdsToDelete = array_diff($existingEngagementIds, $submittedEngagementIds);

            if (!empty($engagementIdsToDelete)) {
                if (($validatedData['confirm_cascade_delete'] ?? false) === false && Versement::whereIn('engagement_id', $engagementIdsToDelete)->exists()) {
                    DB::rollBack();
                    $conflictingEngagements = EngagementFinancier::whereIn('id', $engagementIdsToDelete)->with('partenaire:Id,Description')->get(['id', 'partenaire_id']);
                    $details = $conflictingEngagements->map(fn($eng) => "Engagement ID {$eng->id} avec " . optional($eng->partenaire)->Description)->toArray();
                    return response()->json([
                        'message' => 'Confirmation requise : Certains engagements à supprimer ont des versements associés.',
                        'requires_confirmation' => true,
                        'details' => $details
                    ], 409);
                }
                EngagementFinancier::destroy($engagementIdsToDelete);
                Log::info("Deleted " . count($engagementIdsToDelete) . " engagements for projet {$projet->ID_Projet}.");
            }

            foreach ($submittedEngagements as $engagementData) {
                $dataToSync = [
                    'partenaire_id'         => $engagementData['partenaire_id'],
                    'engagement_type_id'    => $engagementData['engagement_type_id'] ?? null,
                    'montant_engage'        => $engagementData['montant_convenu'] ?? null,
                    'autre_engagement'      => $engagementData['autre_engagement'] ?? null,
                    'date_engagement'       => ($engagementData['is_signatory'] ?? false) && !empty($engagementData['date_signature']) ? $engagementData['date_signature'] : null,
                    'is_signatory'          => $engagementData['is_signatory'] ?? false,
                    'details_signature'     => $engagementData['details_signature'] ?? null,
                    'commentaire'           => $engagementData['engagement_description'] ?? null,
                ];
                $projet->engagementsFinanciers()->updateOrCreate(
                    ['id' => $engagementData['id'] ?? null],
                    $dataToSync
                );
            }
            Log::info("Synced " . $submittedEngagements->count() . " detailed engagements for projet {$projet->ID_Projet}.");

            $docIds = $validatedData['deleted_document_ids'] ?? [];

                if (!empty($docIds)) {
                    $docs = Document::whereIn('Id_Doc', $docIds)->get();

                    foreach ($docs as $doc) {
                        if (!empty($doc->file_path) && File::exists(public_path($doc->file_path))) {
                            File::delete(public_path($doc->file_path));
                        }

                        $doc->delete();
                    }
                }

                if ($request->hasFile('fichiers')) {
                    $targetDir = public_path('uploads/projets');

                    if (!File::isDirectory($targetDir)) {
                        File::makeDirectory($targetDir, 0775, true);
                    }

                    $intitules = $request->input('intitules', []);

                    foreach ($request->file('fichiers') as $index => $file) {
                        $filename = time() . '_' . Str::random(8) . '_' . $file->getClientOriginalName();

                        $file->move($targetDir, $filename);

                        $projet->documents()->create([
                            'Id_Doc' => 'projdoc_' . Str::uuid(),
                            'Intitule' => $intitules[$index] ?? $file->getClientOriginalName(),
                            'file_path' => 'uploads/projets/' . $filename,
                            'file_name' => $file->getClientOriginalName(),
                            'file_type' => $file->getClientMimeType(),
                            'file_size' => $file->getSize(),
                        ]);
                    }
                }

            DB::commit();
            $projet->refresh()->load(['programme', 'convention', 'engagementsFinanciers.partenaire', 'provinces', 'communes', 'secteur']);
            return response()->json(['message' => 'Projet et engagements mis à jour avec succès.', 'projet' => $projet]);

        } catch (QueryException $qe) {
            DB::rollBack();
            Log::error("DB error during projet update (ID_Projet: {$projet->ID_Projet}): " . $qe->getMessage(), ['sql_code' => $qe->getCode()]);
            return response()->json(['message' => 'Erreur Base de Données lors de la mise à jour.'], 500);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("General error during projet update (ID_Projet: {$projet->ID_Projet}): " . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json(['message' => 'Erreur serveur lors de la mise à jour du projet.'], 500);
        }
    }

    public function destroy(string $id_projet_value): JsonResponse
    {
        try {
            $projet = Projet::findOrFail($id_projet_value);
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => 'Projet non trouvé.'], 404);
        }

        $sousProjetsCount = SousProjet::where('ID_Projet_Maitre', $projet->Code_Projet)->count();
        if ($sousProjetsCount > 0) {
            return response()->json([
                'message' => "Impossible de supprimer ce projet : il est lié à {$sousProjetsCount} sous-projet(s).",
            ], 409);
        }

        $engagementIds = $projet->engagementsFinanciers()->pluck('id');
        $versementsCount = $engagementIds->isNotEmpty()
            ? Versement::whereIn('engagement_id', $engagementIds)->count()
            : 0;

        if ($versementsCount > 0) {
            return response()->json([
                'message' => "Impossible de supprimer ce projet : il contient {$versementsCount} versement(s) PP.",
            ], 409);
        }

        DB::beginTransaction();
        try {
            $projet->communes()->detach();
            $projet->provinces()->detach();
            $projet->maitresOuvrage()->detach();
            $projet->maitresOuvrageDelegues()->detach();
            DB::table('convention')->where('id_projet', $projet->ID_Projet)->update(['id_projet' => null]);
            Log::info("Detached non-blocking relations for projet ID_Projet: {$projet->ID_Projet}");

            $projet->engagementsFinanciers()->delete();
            Log::info("Engagements deleted for projet ID_Projet: {$projet->ID_Projet}");

            $projet->delete();
            Log::info("Projet deleted: ID_Projet {$projet->ID_Projet}");

            DB::commit();
            return response()->json(['message' => 'Projet et ses engagements ont été supprimés.'], 200);
        } catch (QueryException $qe) {
            DB::rollBack();
            Log::error("DB error deleting projet ID_Projet {$projet->ID_Projet}: " . $qe->getMessage());
            if ($qe->errorInfo[1] == 1451) {
                return response()->json(['message' => 'Impossible de supprimer: ce projet est référencé ailleurs.'], 409);
            }
            return response()->json(['message' => 'Erreur base de données lors de la suppression.'], 500);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Failed to delete projet (ID_Projet: {$projet->ID_Projet}): " . $e->getMessage());
            return response()->json(['message' => 'Erreur lors de la suppression du projet.'], 500);
        }
    }
}
