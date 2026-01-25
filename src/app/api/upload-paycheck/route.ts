import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseFrenchPaycheck, validatePaycheckData } from '@/lib/pdf/parser';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['application/pdf'];

export async function POST(request: NextRequest) {
  try {
    // Create authenticated Supabase client
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF files are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse PDF
    let parsedData;
    try {
      parsedData = await parseFrenchPaycheck(buffer);
    } catch (error) {
      console.error('PDF parsing error:', error);
      return NextResponse.json(
        { error: 'Failed to parse PDF. Please ensure this is a valid paycheck document.' },
        { status: 400 }
      );
    }

    // Validate parsed data
    if (!validatePaycheckData(parsedData)) {
      return NextResponse.json(
        {
          error: 'Could not extract valid salary information from this PDF.',
          parsedData,
        },
        { status: 400 }
      );
    }

    // Generate unique file path
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${user.id}/${timestamp}-${sanitizedFileName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('paychecks')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload file to storage.' },
        { status: 500 }
      );
    }

    // Insert record into uploaded_documents
    const { data: document, error: dbError } = await supabase
      .from('uploaded_documents')
      .insert({
        user_id: user.id,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type,
        document_type: 'paycheck',
        parsed_data: {
          netSalary: parsedData.netSalary,
          grossSalary: parsedData.grossSalary,
          month: parsedData.month,
          employer: parsedData.employer,
          confidence: parsedData.confidence,
        },
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database insert error:', dbError);
      // Try to clean up uploaded file
      await supabase.storage.from('paychecks').remove([filePath]);
      return NextResponse.json({ error: 'Failed to save document record.' }, { status: 500 });
    }

    // Return success with parsed data
    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        fileName: document.file_name,
        uploadDate: document.upload_date,
      },
      parsedData: {
        netSalary: parsedData.netSalary,
        grossSalary: parsedData.grossSalary,
        month: parsedData.month,
        employer: parsedData.employer,
        confidence: parsedData.confidence,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred during upload.' },
      { status: 500 }
    );
  }
}
